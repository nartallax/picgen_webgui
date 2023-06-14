import {WBox} from "@nartallax/cardboard"
import {allKnownContentTags, allKnownParamSets, allKnownShapeTags, currentArgumentBoxes, currentContentTags, currentLoras, currentParamSetName, currentPrompt, currentShapeTag} from "client/app/global_values"
import {decomposePrompt} from "client/app/prompt_composing"
import {showToast} from "client/controls/toast/toast"
import {GenerationTaskArgument} from "common/entities/arguments"
import {GenerationTaskInputData} from "common/entities/generation_task"
import {LoraArgument} from "common/entities/lora"
import {Picture} from "common/entities/picture"

export function getTaskInputDataFromPicture(picture: Picture, task: GenerationTaskInputData): GenerationTaskInputData {
	const genInputData = {...task}
	const modifiedArgs = picture.modifiedArguments
	if(modifiedArgs){
		genInputData.arguments = {...genInputData.arguments, ...modifiedArgs}
	}
	return genInputData
}

export function loadArguments(task: GenerationTaskInputData): void {
	const paramSet = allKnownParamSets().find(paramSet => paramSet.internalName === task.paramSetName)
	if(!paramSet){
		showToast({
			text: `There's no parameter set ${task.paramSetName} anymore. This task used that parameter set. Cannot load values.`,
			type: "error"
		})
		return
	}

	const promptStr = (task.arguments["prompt"] + "") ?? "" // TODO: cringe
	const prompt = decomposePrompt(promptStr, allKnownShapeTags() ?? [], Object.keys(allKnownContentTags() ?? {}))
	delete task.arguments["prompt"]

	currentParamSetName(task.paramSetName)
	currentShapeTag(prompt.shape)
	currentPrompt(prompt.body)
	currentContentTags(prompt.content)

	const params = {...task.arguments}
	if("loras" in params){
		currentLoras([...params["loras"] as LoraArgument[]])
		delete params["loras"]
	} else if("lores" in params){
		// legacy naming
		currentLoras([...params["lores"] as LoraArgument[]])
		delete params["lores"]
	} else {
		currentLoras([])
	}

	const nonLoadableParamNames: string[] = []
	const boxMap = currentArgumentBoxes()
	for(const [key, value] of Object.entries(params)){
		const argBox = boxMap[key]
		if(!argBox){
			nonLoadableParamNames.push(key)
			continue
		}
		(argBox as WBox<GenerationTaskArgument>)(value)
	}

	if(nonLoadableParamNames.length > 0){
		showToast({
			text: `Some of parameters of the task are now non-existent and were not loaded: ${nonLoadableParamNames.join(", ")}`,
			type: "info"
		})
	}
}