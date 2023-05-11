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
import {box, unbox, viewBox} from "@nartallax/cardboard"
import {isInDOM, localStorageBox, onMount, tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./main_page.module.scss"
import {GenerationTask, GenerationTaskArgument, GenerationTaskWithPictures} from "common/entities/generation_task"
import {GenParameter, GenParameterGroup, GenParameterGroupToggle} from "common/entities/parameter"
import {flatten} from "common/utils/flatten"
import {BinaryQueryCondition} from "common/infra_entities/query"
import {currentArgumentBoxes, allKnownContentTags, currentParamSetName, currentPrompt, currentShapeTag, allKnownShapeTags, allKnownParamSets, currentContentTags} from "client/app/global_values"
import {composePrompt} from "client/app/prompt_composing"

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

	const selectedParamSet = viewBox(() => {
		const paramSetName = currentParamSetName()
		const paramSets = allKnownParamSets()
		const selectedSet = paramSets.find(set => set.internalName === paramSetName)
		return selectedSet
	})

	const paramGroups = selectedParamSet.map(set => set?.parameterGroups ?? [])
	const knownTasks = box([] as GenerationTaskWithPictures[])
	let websocket: WebsocketListener | null = null

	const result = tag({class: css.pageRoot}, [
		tag({class: css.settingsColumn}, [
			LoginBar(),
			Select({
				options: allKnownParamSets.map(sets => sets.map(set => ({label: set.uiName, value: set.internalName}))),
				value: currentParamSetName
			}),
			ParamsBlock({paramGroups}),
			TagSearchBlock({
				selectedContentTags: currentContentTags,
				contentTags: allKnownContentTags,
				visibleTagLimit: 10
			})
		]),
		tag({class: css.generationColumn}, [
			PromptInput({
				promptValue: currentPrompt,
				selectedContentTags: currentContentTags,
				shapeValue: currentShapeTag,
				shapeValues: allKnownShapeTags,
				startGeneration: async() => {
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
						if(def && def.type === "picture" && typeof(paramValue) === "object" && paramValue.id === 0){
							continue // not passed
						}
						paramValuesForApi[paramName] = paramValue
					}
					await ClientApi.createGenerationTask({
						prompt: fullPrompt,
						paramSetName: currentParamSetName(),
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
		updateArgumentBoxes(currentParamSetName(), groups)
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