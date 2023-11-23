import {ClientApi} from "client/app/client_api"
import {WebsocketListener} from "client/app/websocket_listener"
import {PromptInput} from "client/components/prompt_input/prompt_input"
import {WBox, box, calcBox} from "@nartallax/cardboard"
import {onMount, tag} from "@nartallax/cardboard-dom"
import * as css from "./main_page.module.scss"
import {GenerationTaskWithPictures} from "common/entities/generation_task"
import {GenParameter, GenerationParameterSet} from "common/entities/parameter"
import {currentParamSetName, allKnownParamSets, allKnownJsonFileLists, hideSomeScrollbars, argumentsByParamSet, limitThumbnailWidth, queueStatus} from "client/app/global_values"
import {Row} from "client/controls/layout/row_col"
import {isPictureArgument} from "common/entities/arguments"
import {Tabs} from "client/controls/tabs/tabs"
import {SwitchPanel} from "client/controls/switch_panel/switch_panel"
import {JsonFileListItemDescription} from "common/entities/json_file_list"
import {fixArgumentMap, getAllGenParamDefs} from "client/app/fix_argument_object"
import {getLockBox} from "client/controls/lock_button/lock_button"
import {PictureFeed} from "client/components/feeds/picture_feed"
import {TaskFeed} from "client/components/feeds/task_feed"
import {MainMenu} from "client/components/main_menu/main_menu"
import {MainMenuButton} from "client/components/main_menu/main_menu_button"
import {SearchBar} from "client/components/search_bar/search_bar"
import {SearchFeed} from "client/components/feeds/search_feed"
import {userStaticThumbnailProvider} from "client/pages/main_page/user_static_thumbnail_provider"

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
	const isSearchActive = box(false)
	const searchText = box("")

	const result = tag({
		class: css.pageRoot,
		attrs: {
			"data-hide-some-scrollbars": hideSomeScrollbars.map(hide => hide ? "true" : "false"),
			"data-limit-thumbnail-width": limitThumbnailWidth.map(limit => limit ? "true" : "false")
		}
	}, [areGlobalsLoaded.map(areGlobalsLoaded => {
		if(!areGlobalsLoaded){
			return "Loading..."
		}

		return [
			tag({class: css.generationColumn}, [
				SwitchPanel({
					class: css.mainPageSwitchPanel,
					value: isSearchActive.map(isActive => isActive ? "search" : "dflt"),
					routes: {
						search: () => SearchFeed({searchText}),
						dflt: () => tag({class: css.defaultTabsAndSwitchPanelWrap}, [
							SwitchPanel({
								value: selectedTab,
								class: css.mainPageSwitchPanel,
								routes: {
									favorites: () => PictureFeed({
										fetch: query => {
											(query.filters ||= []).push({a: {field: "favoritesAddTime"}, op: "!=", b: {value: null}})
											return ClientApi.listPicturesWithTasks(query)
										},
										sortBy: "favoritesAddTime"
									}),
									tasks: () => TaskFeed({
										fetch: ClientApi.listTasks,
										values: knownTasks
									})
								}
							}),
							Tabs({
								options: [
									{label: "Tasks", value: "tasks"},
									{label: "Favorites", value: "favorites"}
								] as const,
								value: selectedTab
							})
						])
					}
				}),
				Row({align: "start", gap: true, padding: [0, "3rem", "0.5rem", "3rem"], class: css.topInputRow}, [
					MainMenuButton({isOpen: isMenuOpen}),
					selectedParamSet.map(paramSet => PromptInput({
						isLocked: getLockBox(paramSet, paramSet.primaryParameter.jsonName),
						promptValue: argumentsByParamSet
							.prop(paramSet.internalName)
							.prop(paramSet.primaryParameter.jsonName) as WBox<string>,
						startGeneration: startGeneration
					})),
					SearchBar({isSearchActive, searchText})
				])
			]),
			MainMenu({isOpen: isMenuOpen, selectedParamSet})
		]
	})])

	onMount(result, () => {
		const handler = (e: KeyboardEvent) => {
			if(e.key !== "Enter" || !e.ctrlKey){
				return
			}

			e.stopPropagation()
			e.preventDefault()
			void startGeneration()
		}

		window.addEventListener("keydown", handler, {capture: true})
		return () => window.removeEventListener("keydown", handler)
	})

	void loadGlobalData(result, knownTasks).then(() => areGlobalsLoaded.set(true))

	return result
}

async function loadGlobalData(page: HTMLElement, knownTasks: WBox<GenerationTaskWithPictures[]>): Promise<void> {
	void userStaticThumbnailProvider.loadUserStaticThumbnails()

	const [paramSets, jsonFileLists, isQueuePaused] = await Promise.all([
		ClientApi.getGenerationParameterSets(),
		ClientApi.getAllJsonFileLists(),
		ClientApi.getIsQueuePaused()
	])

	queueStatus.set(isQueuePaused ? "paused" : "running")

	const jsonListsMap: Record<string, readonly JsonFileListItemDescription[]> = {}
	for(const list of jsonFileLists){
		jsonListsMap[list.directory] = list.items
	}
	allKnownJsonFileLists.set(jsonListsMap)

	const websocket = new WebsocketListener(knownTasks)
	onMount(page, () => {
		void websocket.start()
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