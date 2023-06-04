import {ClientApi} from "client/app/client_api"
import {WebsocketListener} from "client/app/websocket_listener"
import {Feed, makeSimpleFeedFetcher} from "client/controls/feed/feed"
import {LoginBar} from "client/components/login_bar/login_bar"
import {ParamsBlock} from "client/components/arguments_input_block/arguments_input_block"
import {PromptInput} from "client/components/prompt_input/prompt_input"
import {Select} from "client/controls/select/select"
import {TagSearchBlock} from "client/controls/tag_search_block/tag_search_block"
import {TaskPanel} from "client/components/task_panel/task_panel"
import {box, unbox, viewBox} from "@nartallax/cardboard"
import {isInDOM, localStorageBox, onMount, tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./main_page.module.scss"
import {GenerationTask, GenerationTaskWithPictures} from "common/entities/generation_task"
import {GenParameter, GenParameterGroup, GenParameterGroupToggle, defaultValueOfParam} from "common/entities/parameter"
import {flatten} from "common/utils/flatten"
import {currentArgumentBoxes, allKnownContentTags, currentParamSetName, currentPrompt, currentShapeTag, allKnownShapeTags, allKnownParamSets, currentContentTags, allKnownLores, currentLores} from "client/app/global_values"
import {composePrompt} from "client/app/prompt_composing"
import {AdminButtons} from "client/components/admin_buttons/admin_buttons"
import {Sidebar} from "client/controls/sidebar/sidebar"
import {Col, Row} from "client/controls/layout/row_col"
import {IconButton} from "client/controls/icon_button/icon_button"
import {GenerationTaskArgument, isPictureArgument} from "common/entities/arguments"
import {Tabs} from "client/controls/tabs/tabs"
import {SwitchPanel} from "client/controls/switch_panel/switch_panel"
import {Picture, PictureWithTask} from "common/entities/picture"
import {TaskPicture} from "client/components/task_picture/task_picture"
import {LoreSelectionPanel} from "client/components/lore_selection_panel/lore_selection_panel"

function updateArgumentBoxes(setName: string, groups: readonly GenParameterGroup[]) {
	const defs: (GenParameter | GenParameterGroupToggle)[] = flatten(groups.map(group => group.parameters))
	for(const group of groups){
		if(group.toggle){
			defs.push(group.toggle)
		}
	}

	const defMap = new Map(defs.map(x => [x.jsonName, x]))
	for(const name in currentArgumentBoxes){
		const value = currentArgumentBoxes[name]!
		const def = defMap.get(name)
		if(!def || typeof(value()) !== typeof(defaultValueOfParam(def))){
			delete currentArgumentBoxes[name]
			continue
		}
	}

	for(const def of defs){
		const oldValue = currentArgumentBoxes[def.jsonName]
		if(oldValue){
			continue
		}
		currentArgumentBoxes[def.jsonName] = localStorageBox(`genArgument.${setName}.${def.jsonName}`, defaultValueOfParam(def))
	}
}

export function MainPage(): HTMLElement {

	const selectedParamSet = viewBox(() => {
		const paramSetName = currentParamSetName()
		const paramSets = allKnownParamSets()
		const selectedSet = paramSets.find(set => set.internalName === paramSetName)
		return selectedSet
	})

	const paramGroups = selectedParamSet.map(set => set?.parameterGroups ?? [])
	const knownTasks = box([] as GenerationTaskWithPictures[])
	let websocket: WebsocketListener | null = null

	const startGeneration = async() => {
		const fullPrompt = composePrompt({
			shape: currentShapeTag(),
			body: currentPrompt(),
			content: currentContentTags()
		})
		const paramValuesForApi = {} as Record<string, GenerationTaskArgument>
		const paramDefs = flatten(unbox(paramGroups).map(group => group.parameters))
		if(!paramDefs){
			return
		}
		const paramDefsByName = new Map(paramDefs.map(def => [def.jsonName, def]))
		for(const paramName in currentArgumentBoxes){
			const paramValue = unbox(currentArgumentBoxes[paramName])!
			const def = paramDefsByName.get(paramName)
			if(def && def.type === "picture" && isPictureArgument(paramValue) && paramValue.id === 0){
				continue // not passed
			}
			paramValuesForApi[paramName] = paramValue
		}
		if(currentLores().length > 0){
			paramValuesForApi["lores"] = currentLores()
		}
		await ClientApi.createGenerationTask({
			prompt: fullPrompt,
			paramSetName: currentParamSetName(),
			params: paramValuesForApi
		})
	}

	const isMenuOpen = box(false)

	const selectedTab = box<"tasks" | "favorites">("tasks")

	const result = tag({class: css.pageRoot}, [
		tag({class: css.generationColumn}, [
			Row({align: "start", gap: true, padding: "bottom"}, [
				IconButton({
					icon: "icon-menu",
					onClick: () => isMenuOpen(!isMenuOpen()),
					class: css.menuButton
				}),
				PromptInput({
					promptValue: currentPrompt,
					selectedContentTags: currentContentTags,
					shapeValue: currentShapeTag,
					shapeValues: allKnownShapeTags,
					startGeneration: startGeneration
				})
			]),
			Tabs({
				options: [
					{label: "Tasks", value: "tasks"},
					{label: "Favorites", value: "favorites"}
				] as const,
				value: selectedTab
			}),
			SwitchPanel({
				value: selectedTab,
				class: css.mainPageSwitchPanel,
				routes: {
					favorites: () => Feed({
						class: css.mainPageFeed,
						containerClass: css.favoritesFeed,
						getId: picture => picture.id,
						renderElement: picture => TaskPicture({picture}),
						loadNext: makeSimpleFeedFetcher<Picture, PictureWithTask>({
							fetch: query => {
								(query.filters ||= []).push(
									{a: {field: "favoritesAddTime"}, op: "!=", b: {value: null}}
								)
								return ClientApi.listPicturesWithTasks(query)
							},
							desc: true,
							packSize: 50
						})
					}),
					tasks: () => Feed({
						getId: task => task.id,
						loadNext: makeSimpleFeedFetcher<GenerationTask, GenerationTaskWithPictures>({
							fetch: ClientApi.listTasks,
							desc: true,
							packSize: 10
						}),
						values: knownTasks,
						renderElement: taskBox => TaskPanel({task: taskBox}),
						bottomLoadingPlaceholder: tag(["Loading..."]),
						class: css.mainPageFeed
					})
				}
			})
		]),
		Sidebar({isOpen: isMenuOpen}, [
			tag({class: css.settingsColumn}, [
				Row({align: "start"}, [
					IconButton({
						icon: "icon-menu",
						onClick: () => isMenuOpen(!isMenuOpen()),
						class: css.menuButton
					}),
					LoginBar()
				]),
				Col({class: css.propSetSelector, align: "stretch"}, [
					Select({
						options: allKnownParamSets.map(sets => sets.map(set => ({
							label: set.uiName,
							value: set.internalName
						}))),
						value: currentParamSetName
					})
				]),
				ParamsBlock({paramGroups}),
				TagSearchBlock({
					selectedContentTags: currentContentTags,
					contentTags: allKnownContentTags,
					visibleTagLimit: 10
				}),
				LoreSelectionPanel(),
				AdminButtons()
			])
		])
	])

	onMount(result, () => {
		websocket?.start()
		return () => websocket?.stop()
	})

	whileMounted(result, paramGroups, groups => {
		updateArgumentBoxes(currentParamSetName(), groups)
	});

	(async() => {
		const [paramSets, contentTags, shapeTags, lores] = await Promise.all([
			ClientApi.getGenerationParameterSets(),
			ClientApi.getContentTags(),
			ClientApi.getShapeTags(),
			ClientApi.getAvailableLores()
		])

		allKnownLores(lores)

		websocket = new WebsocketListener(knownTasks)
		if(isInDOM(result)){
			websocket.start()
		}

		allKnownShapeTags(shapeTags)
		if(currentShapeTag() === null){
			currentShapeTag(shapeTags[0] || "Landscape")
		}

		allKnownParamSets(paramSets)

		const paramSetName = currentParamSetName()
		const paramSet = paramSets.find(set => set.internalName === paramSetName)
		if(!paramSet){
			const firstParamSet = paramSets[0]
			if(firstParamSet){
				currentParamSetName(firstParamSet.internalName)
			}
		}

		allKnownContentTags(contentTags)
	})()

	return result
}