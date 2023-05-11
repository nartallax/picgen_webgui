import {ClientApi} from "client/app/client_api"
import {WebsocketListener} from "client/app/websocket_listener"
import {Feed} from "client/controls/feed/feed"
import {LoginBar} from "client/controls/login_bar/login_bar"
import {ParamsBlock} from "client/controls/params_block/params_block"
import {defaultValueOfParam} from "client/controls/param_line/param_line"
import {PromptInput} from "client/controls/prompt_input/prompt_input"
import {Select} from "client/controls/select/select"
import {TagSearchBlock} from "client/controls/tag_search_block/tag_search_block"
import {TaskPanel} from "client/controls/task_panel/task_panel"
import {box, unbox, viewBox, WBox} from "@nartallax/cardboard"
import {isInDOM, onMount, tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./main_page.module.scss"
import {GenerationTask, GenerationTaskArgument, GenerationTaskWithPictures} from "common/entities/generation_task"
import {GenerationParameterSet, GenParameter, GenParameterGroup, GenParameterGroupToggle} from "common/entities/parameter"
import {flatten} from "common/utils/flatten"
import {BinaryQueryCondition} from "common/infra_entities/query"

function updateParamValues(paramValues: {[key: string]: WBox<GenerationTaskArgument>}, groups: readonly GenParameterGroup[]) {
	const defs: (GenParameter | GenParameterGroupToggle)[] = flatten(groups.map(group => group.parameters))
	for(const group of groups){
		if(group.toggle){
			defs.push(group.toggle)
		}
	}

	const defMap = new Map(defs.map(x => [x.jsonName, x]))
	for(const name in paramValues){
		const value = paramValues[name]!
		const def = defMap.get(name)
		if(!def || typeof(value()) !== typeof(defaultValueOfParam(def))){
			delete paramValues[name]
			continue
		}
	}

	for(const def of defs){
		const oldValue = paramValues[def.jsonName]
		if(oldValue){
			continue
		}
		paramValues[def.jsonName] = box(defaultValueOfParam(def))
	}
}

async function loadNextTaskPack(existingTasks: GenerationTaskWithPictures[]): Promise<GenerationTaskWithPictures[]> {
	const lastTask = existingTasks[existingTasks.length - 1]
	const filters: BinaryQueryCondition<GenerationTask>[] = []
	if(lastTask){
		filters.push({
			a: {field: "id"},
			op: "<",
			b: {value: lastTask.id}
		})
	}
	return ClientApi.listTasks({
		sortBy: "creationTime",
		desc: true,
		limit: 10,
		filters
	})
}

export function MainPage(): HTMLElement {

	const selectedParamSetName = box("")
	const knownParamSets = box([] as GenerationParameterSet[])
	const selectedParamSet = viewBox(() => {
		const paramSetName = selectedParamSetName()
		const paramSets = knownParamSets()
		const selectedSet = paramSets.find(set => set.internalName === paramSetName)
		return selectedSet
	})

	const paramValues = {} as {[key: string]: WBox<GenerationTaskArgument>}
	const paramGroups = selectedParamSet.map(set => set?.parameterGroups ?? [])

	const contentTagBox = box(null as null | {readonly [tagContent: string]: readonly string[]})
	const selectedContentTags = box([] as string[])

	const knownTasks = box([] as GenerationTaskWithPictures[])
	let websocket: WebsocketListener | null = null

	const loadingContentShapeValue = "Loading..."
	const shapeTagValue = box(loadingContentShapeValue)
	const shapeTagsBox = box(null as null | readonly string[])

	const promptValue = box("")

	const result = tag({class: css.pageRoot}, [
		tag({class: css.settingsColumn}, [
			LoginBar(),
			Select({
				options: knownParamSets.map(sets => sets.map(set => ({label: set.uiName, value: set.internalName}))),
				value: selectedParamSetName
			}),
			ParamsBlock({paramSetName: selectedParamSetName, paramGroups, paramValues}),
			TagSearchBlock({
				selectedContentTags,
				contentTags: contentTagBox,
				visibleTagLimit: 10
			})
		]),
		tag({class: css.generationColumn}, [
			PromptInput({
				promptValue: promptValue,
				selectedContentTags: selectedContentTags,
				shapeValue: shapeTagValue,
				shapeValues: shapeTagsBox,
				startGeneration: async() => {
					const fullPrompt = shapeTagValue() + " " + promptValue() + selectedContentTags().join(", ")
					const paramValuesForApi = {} as Record<string, GenerationTaskArgument>
					const paramDefs = flatten(unbox(paramGroups).map(group => group.parameters))
					if(!paramDefs){
						return
					}
					const paramDefsByName = new Map(paramDefs.map(def => [def.jsonName, def]))
					for(const paramName in paramValues){
						const paramValue = unbox(paramValues[paramName])!
						const def = paramDefsByName.get(paramName)
						if(def && def.type === "picture" && typeof(paramValue) === "object" && paramValue.id === 0){
							continue // not passed
						}
						paramValuesForApi[paramName] = paramValue
					}
					await ClientApi.createGenerationTask({
						prompt: fullPrompt,
						paramSetName: selectedParamSetName(),
						params: paramValuesForApi
					})
				}
			}),
			Feed({
				getId: task => task.id,
				loadNext: loadNextTaskPack,
				values: knownTasks,
				renderElement: taskBox => TaskPanel({task: taskBox}),
				bottomLoadingPlaceholder: tag(["Loading..."])
			})
		])
	])

	onMount(result, () => {
		websocket?.start()
		return () => websocket?.stop()
	})

	whileMounted(result, paramGroups, groups => {
		updateParamValues(paramValues, groups)
	});

	(async() => {
		const [paramSets, contentTags, shapeTags] = await Promise.all([
			ClientApi.getGenerationParameterSets(),
			ClientApi.getContentTags(),
			ClientApi.getShapeTags()
		])

		websocket = new WebsocketListener(knownTasks)
		if(isInDOM(result)){
			websocket.start()
		}

		shapeTagsBox(shapeTags)
		if(shapeTagValue() === loadingContentShapeValue){
			shapeTagValue(shapeTags[0] || "Landscape")
		}

		knownParamSets(paramSets)
		const firstParamSet = paramSets[0]
		if(firstParamSet){
			selectedParamSetName(firstParamSet.internalName)
		}

		contentTagBox(contentTags)
	})()

	return result
}