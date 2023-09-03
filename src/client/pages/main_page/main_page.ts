import {ClientApi} from "client/app/client_api"
import {WebsocketListener} from "client/app/websocket_listener"
import {Feed, makeSimpleFeedFetcher} from "client/controls/feed/feed"
import {LoginBar} from "client/components/login_bar/login_bar"
import {ArgumentsInputBlock} from "client/components/arguments_input_block/arguments_input_block"
import {PromptInput} from "client/components/prompt_input/prompt_input"
import {Select} from "client/controls/select/select"
import {TaskPanel} from "client/components/task_panel/task_panel"
import {WBox, box, calcBox} from "@nartallax/cardboard"
import {onMount, tag} from "@nartallax/cardboard-dom"
import * as css from "./main_page.module.scss"
import {GenerationTask, GenerationTaskWithPictures} from "common/entities/generation_task"
import {GenParameter, GenerationParameterSet} from "common/entities/parameter"
import {currentParamSetName, allKnownParamSets, allKnownJsonFileLists, hideSomeScrollbars, thumbnailProvider, argumentsByParamSet} from "client/app/global_values"
import {AdminButtons} from "client/components/admin_buttons/admin_buttons"
import {Sidebar} from "client/controls/sidebar/sidebar"
import {Row} from "client/controls/layout/row_col"
import {IconButton} from "client/controls/icon_button/icon_button"
import {isPictureArgument} from "common/entities/arguments"
import {Tabs} from "client/controls/tabs/tabs"
import {SwitchPanel} from "client/controls/switch_panel/switch_panel"
import {Picture, PictureWithTask} from "common/entities/picture"
import {TaskPicture} from "client/components/task_picture/task_picture"
import {PasteArgumentsButton} from "client/components/paste_arguments_button/paste_arguments_button"
import {JsonFileListItemDescription} from "common/entities/json_file_list"
import {fixArgumentMap, getAllGenParamDefs} from "client/app/fix_argument_object"
import {Icon} from "client/generated/icons"
import {LockButton, getLockBox, getSetLockBoxes, makeGroupLockBox} from "client/controls/lock_button/lock_button"

export function MainPage(): HTMLElement {

	const selectedParamSet = calcBox([currentParamSetName, allKnownParamSets], (paramSetName, paramSets) => {
		const selectedSet = paramSets.find(set => set.internalName === paramSetName) ?? paramSets[0]
		return selectedSet ?? paramSets[0] ?? GenerationParameterSet.getValue()
	})

	const knownTasks = box([] as GenerationTaskWithPictures[])

	const startGeneration = async() => {
		const paramDefs = getAllGenParamDefs(selectedParamSet.get())

		const paramValuesForApi = {...argumentsByParamSet.get()[selectedParamSet.get().internalName] ?? {}}
		for(const def of paramDefs){
			const paramValue = paramValuesForApi[def.jsonName]!
			if((def as GenParameter).type === "picture" && isPictureArgument(paramValue) && paramValue.id === 0){
				delete paramValuesForApi[def.jsonName] // not passed
			}
		}

		await ClientApi.createGenerationTask({
			paramSetName: currentParamSetName.get(),
			arguments: paramValuesForApi
		})
	}

	const isMenuOpen = box(false)
	const selectedTab = box<"tasks" | "favorites">("tasks")

	const areGlobalsLoaded = box(false)

	const result = tag({
		class: css.pageRoot,
		attrs: {
			"data-hide-some-scrollbars": hideSomeScrollbars.map(hide => hide ? "true" : "false")
		}
	}, [areGlobalsLoaded.map(areGlobalsLoaded => {
		if(!areGlobalsLoaded){
			return "Loading..."
		}

		return [
			tag({class: css.generationColumn}, [
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
				}),
				Tabs({
					options: [
						{label: "Tasks", value: "tasks"},
						{label: "Favorites", value: "favorites"}
					] as const,
					value: selectedTab
				}),
				Row({align: "start", gap: true, padding: "bottom"}, [
					IconButton({
						icon: Icon.menu,
						onClick: () => isMenuOpen.set(!isMenuOpen.get()),
						class: css.menuButton
					}),
					selectedParamSet.map(paramSet => PromptInput({
						isLocked: getLockBox(paramSet, paramSet.primaryParameter.jsonName),
						promptValue: argumentsByParamSet
							.prop(paramSet.internalName)
							.prop(paramSet.primaryParameter.jsonName) as WBox<string>,
						startGeneration: startGeneration
					}))
				])
			]),
			Sidebar({isOpen: isMenuOpen}, [
				tag({class: css.settingsColumn}, [
					Row({align: "start"}, [
						IconButton({
							icon: Icon.menu,
							onClick: () => isMenuOpen.set(!isMenuOpen.get()),
							class: css.menuButton
						}),
						LoginBar(),
						PasteArgumentsButton()
					]),
					Row({class: css.propSetSelector, align: "stretch", gap: true}, [
						selectedParamSet.map(paramSet => {
							const setLocks = getSetLockBoxes(paramSet)
							const groupLock = makeGroupLockBox(setLocks)
							return LockButton({
								isLocked: groupLock,
								onChange: () => {
									const shouldBeLocked = !groupLock.get()
									for(const lock of setLocks){
										lock.set(shouldBeLocked)
									}
								}
							})
						}),
						Select({
							class: css.paramSetSelect,
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
		]
	})])

	loadGlobalData(result, knownTasks).then(() => areGlobalsLoaded.set(true))

	return result
}

async function loadGlobalData(page: HTMLElement, knownTasks: WBox<GenerationTaskWithPictures[]>): Promise<void> {
	const [paramSets, jsonFileLists] = await Promise.all([
		ClientApi.getGenerationParameterSets(),
		ClientApi.getAllJsonFileLists()
	])

	const jsonListsMap: Record<string, readonly JsonFileListItemDescription[]> = {}
	for(const list of jsonFileLists){
		jsonListsMap[list.directory] = list.items
	}
	allKnownJsonFileLists.set(jsonListsMap)

	const websocket = new WebsocketListener(knownTasks)
	onMount(page, () => {
		websocket.start()
		return () => websocket.stop()
	}, {ifInDom: "call"})

	const argsBySet = {...argumentsByParamSet.get()}
	for(const paramSet of paramSets){
		argsBySet[paramSet.internalName] = fixArgumentMap(argsBySet[paramSet.internalName] ?? {}, paramSet)
	}
	argumentsByParamSet.set(argsBySet)
	allKnownParamSets.set(paramSets)

	const paramSetName = currentParamSetName.get()
	const paramSet = paramSets.find(set => set.internalName === paramSetName)
	if(!paramSet){
		const firstParamSet = paramSets[0]
		if(firstParamSet){
			currentParamSetName.set(firstParamSet.internalName)
		}
	}

}