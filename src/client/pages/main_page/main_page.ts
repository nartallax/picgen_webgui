import {ClientApi} from "client/app/client_api"
import {WebsocketListener} from "client/app/websocket_listener"
import {Feed, makeSimpleFeedFetcher} from "client/controls/feed/feed"
import {LoginBar} from "client/components/login_bar/login_bar"
import {ArgumentsInputBlock} from "client/components/arguments_input_block/arguments_input_block"
import {PromptInput} from "client/components/prompt_input/prompt_input"
import {Select} from "client/controls/select/select"
import {TaskPanel} from "client/components/task_panel/task_panel"
import {box, calcBox, unbox} from "@nartallax/cardboard"
import {bindBox, localStorageBox, onMount, tag} from "@nartallax/cardboard-dom"
import * as css from "./main_page.module.scss"
import {GenerationTask, GenerationTaskWithPictures} from "common/entities/generation_task"
import {GenParameter, GenParameterGroup, GenParameterGroupToggle, GenerationParameterSet, defaultValueOfParam} from "common/entities/parameter"
import {flatten} from "common/utils/flatten"
import {currentArgumentBoxes, currentParamSetName, currentPrompt, currentShapeTag, allKnownShapeTags, allKnownParamSets, allKnownJsonFileLists, hideSomeScrollbars, thumbnailProvider} from "client/app/global_values"
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
import {PasteArgumentsButton} from "client/components/paste_arguments_button/paste_arguments_button"
import {JsonFileListItemDescription} from "common/entities/json_file_list"

type GenParamLike = (GenParameter | GenParameterGroupToggle) & {readonly jsonName: string}
function isGenParamLike(param: GenParameter | GenParameterGroupToggle): param is GenParamLike {
	return typeof((param as GenParamLike).jsonName) === "string"
}

function updateArgumentBoxes(setName: string, groups: readonly GenParameterGroup[]) {
	const defs: GenParamLike[] = flatten(groups.map(group => group.parameters))
	for(const group of groups){
		if(group.toggle && isGenParamLike(group.toggle)){
			defs.push(group.toggle)
		}
	}

	const boxMap = {...currentArgumentBoxes.get()}
	for(const name in boxMap){
		delete boxMap[name]
	}

	for(const def of defs){
		// TODO: they will never go out of memory, cringe
		// maybe we need some global provider...? to not create them over and over again
		// or, better yet, create a single box for each set once and that's it
		boxMap[def.jsonName] = localStorageBox(document.body, `genArgument.${setName}.${def.jsonName}`, defaultValueOfParam(def))
	}

	currentArgumentBoxes.set(boxMap)
}

export function MainPage(): HTMLElement {

	const selectedParamSet = calcBox([currentParamSetName, allKnownParamSets], (paramSetName, paramSets) => {
		const selectedSet = paramSets.find(set => set.internalName === paramSetName) ?? paramSets[0]
		return selectedSet ?? paramSets[0] ?? GenerationParameterSet.getValue()
	})

	const paramGroups = selectedParamSet.map(set => set.parameterGroups)
	const knownTasks = box([] as GenerationTaskWithPictures[])

	const startGeneration = async() => {
		const fullPrompt = composePrompt({
			shape: currentShapeTag.get(),
			body: currentPrompt.get()
		})
		const paramValuesForApi = {} as Record<string, GenerationTaskArgument>
		const paramDefs = flatten(unbox(paramGroups).map(group => group.parameters))
		if(!paramDefs){
			return
		}
		const paramDefsByName = new Map(paramDefs.map(def => [def.jsonName, def]))
		const boxMap = currentArgumentBoxes.get()
		for(const paramName in boxMap){
			const paramValue = unbox(boxMap[paramName])!
			const def = paramDefsByName.get(paramName)
			if(def && def.type === "picture" && isPictureArgument(paramValue) && paramValue.id === 0){
				continue // not passed
			}
			paramValuesForApi[paramName] = paramValue
		}
		// TODO: cringe
		paramValuesForApi["prompt"] = fullPrompt
		await ClientApi.createGenerationTask({
			paramSetName: currentParamSetName.get(),
			arguments: paramValuesForApi
		})
	}

	const isMenuOpen = box(false)

	const selectedTab = box<"tasks" | "favorites">("tasks")

	const result = tag({
		class: css.pageRoot,
		attrs: {
			"data-hide-some-scrollbars": hideSomeScrollbars.map(hide => hide ? "true" : "false")
		}
	}, [
		tag({class: css.generationColumn}, [
			Row({align: "start", gap: true, padding: "bottom"}, [
				IconButton({
					icon: "icon-menu",
					onClick: () => isMenuOpen.set(!isMenuOpen.get()),
					class: css.menuButton
				}),
				PromptInput({
					promptValue: currentPrompt,
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
					favorites: () => {
						const thumbContext = thumbnailProvider.makeContext()
						return Feed({
							scrollToTopButton: true,
							class: css.mainPageFeed,
							containerClass: css.favoritesFeed,
							getId: picture => picture.id,
							renderElement: picture => TaskPicture({picture, thumbContext}),
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
						})
					},
					tasks: () => Feed({
						scrollToTopButton: true,
						getId: task => task.id,
						loadNext: makeSimpleFeedFetcher<GenerationTask, GenerationTaskWithPictures>({
							fetch: ClientApi.listTasks,
							desc: true,
							packSize: 10
						}),
						values: knownTasks,
						renderElement: taskBox => TaskPanel({task: taskBox, tasks: knownTasks}),
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
						onClick: () => isMenuOpen.set(!isMenuOpen.get()),
						class: css.menuButton
					}),
					LoginBar(),
					PasteArgumentsButton()
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
				tag({class: css.settingsColumnScrollablePart}, [
					ArgumentsInputBlock({paramSet: selectedParamSet}),
					AdminButtons()
				])
			])
		])
	])

	bindBox(result, paramGroups, groups => {
		updateArgumentBoxes(currentParamSetName.get(), groups)
	});

	(async() => {
		const [paramSets, shapeTags, jsonFileLists] = await Promise.all([
			ClientApi.getGenerationParameterSets(),
			ClientApi.getShapeTags(),
			ClientApi.getAllJsonFileLists()
		])

		const jsonListsMap: Record<string, readonly JsonFileListItemDescription[]> = {}
		for(const list of jsonFileLists){
			jsonListsMap[list.directory] = list.items
		}
		allKnownJsonFileLists.set(jsonListsMap)

		const websocket = new WebsocketListener(knownTasks)
		onMount(result, () => {
			websocket.start()
			return () => websocket.stop()
		}, {ifInDom: "call"})

		allKnownShapeTags.set(shapeTags)
		if(currentShapeTag.get() === null){
			currentShapeTag.set(shapeTags[0] || "Landscape")
		}

		allKnownParamSets.set(paramSets)

		const paramSetName = currentParamSetName.get()
		const paramSet = paramSets.find(set => set.internalName === paramSetName)
		if(!paramSet){
			const firstParamSet = paramSets[0]
			if(firstParamSet){
				currentParamSetName.set(firstParamSet.internalName)
			}
		}

	})()

	return result
}