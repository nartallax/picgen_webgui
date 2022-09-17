import {ClientApi} from "client/app/client_api"
import {WebsocketListener} from "client/app/websocket_listener"
import {getBinder} from "client/base/binder/binder"
import {box, unbox, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {LoginBar} from "client/controls/login_bar/login_bar"
import {ParamsBlock} from "client/controls/params_block/params_block"
import {PromptInput} from "client/controls/prompt_input/prompt_input"
import {TagSearchBlock} from "client/controls/tag_search_block/tag_search_block"
import {TaskList} from "client/controls/task_list/task_list"
import {GenParameterDefinition} from "common/common_types"
import {GenerationTaskParameterValue, GenerationTaskWithPictures} from "common/entity_types"

function updateParamValues(paramValues: {[key: string]: WBox<GenParameterDefinition["default"]>}, defs: readonly GenParameterDefinition[]) {
	const defMap = new Map(defs.map(x => [x.jsonName, x]))
	for(const name in paramValues){
		const value = paramValues[name]!
		const def = defMap.get(name)
		if(!def || typeof(value()) !== typeof(def.default)){
			delete paramValues[name]
			continue
		}
	}

	for(const def of defs){
		const oldValue = paramValues[def.jsonName]
		if(oldValue){
			continue
		}
		paramValues[def.jsonName] = box(def.default)
	}
}

export function MainPage(): HTMLElement {

	const paramValues = {} as {[key: string]: WBox< GenParameterDefinition["default"]>}
	const paramDefsBox = box(null as null | readonly GenParameterDefinition[])

	const contentTagBox = box(null as null | {readonly [tagContent: string]: readonly string[]})
	const selectedContentTags = box([] as string[])

	const knownTasks = box([] as GenerationTaskWithPictures[])
	let websocket: WebsocketListener | null = null

	const loadingContentShapeValue = "Loading..."
	const shapeTagValue = box(loadingContentShapeValue)
	const shapeTagsBox = box(null as null | readonly string[])

	const promptValue = box("")

	const result = tag({class: "page-root"}, [
		tag({class: "settings-column"}, [
			LoginBar(),
			ParamsBlock({paramDefs: paramDefsBox, paramValues}),
			TagSearchBlock({
				selectedContentTags,
				contentTags: contentTagBox,
				visibleTagLimit: 10
			})
		]),
		tag({class: "generation-column"}, [
			PromptInput({
				promptValue: promptValue,
				selectedContentTags: selectedContentTags,
				shapeValue: shapeTagValue,
				shapeValues: shapeTagsBox,
				startGeneration: async() => {
					const fullPrompt = shapeTagValue() + " " + promptValue() + selectedContentTags().join(", ")
					const paramValuesForApi = {} as Record<string, GenerationTaskParameterValue>
					for(const paramName in paramValues){
						paramValuesForApi[paramName] = unbox(paramValues[paramName])!
					}
					await ClientApi.createGenerationTask({
						prompt: fullPrompt,
						params: paramValuesForApi
					})
				}
			}),
			TaskList({tasks: knownTasks})
		])
	])

	const binder = getBinder(result)
	binder.onNodeInserted(() => websocket?.start())
	binder.onNodeRemoved(() => websocket?.stop());

	(async() => {
		const [paramDefs, contentTags, shapeTags, tasks] = await Promise.all([
			ClientApi.getGenerationParameterDefinitions(),
			ClientApi.getContentTags(),
			ClientApi.getShapeTags(),
			ClientApi.listTasks({
				sortBy: "creationTime",
				desc: true,
				limit: 10,
				offset: 0
			})
		])

		knownTasks(tasks)
		websocket = new WebsocketListener(knownTasks)
		if(binder.isInDom){
			websocket.start()
		}

		shapeTagsBox(shapeTags)
		if(shapeTagValue() === loadingContentShapeValue){
			shapeTagValue(shapeTags[0] || "Landscape")
		}

		updateParamValues(paramValues, paramDefs)
		paramDefsBox(paramDefs)

		contentTagBox(contentTags)
	})()

	return result
}