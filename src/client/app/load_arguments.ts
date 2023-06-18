import {WBox} from "@nartallax/cardboard"
import {allKnownContentTags, allKnownParamSets, allKnownShapeTags, currentArgumentBoxes, currentContentTags, currentParamSetName, currentPrompt, currentShapeTag} from "client/app/global_values"
import {decomposePrompt} from "client/app/prompt_composing"
import {showToast} from "client/controls/toast/toast"
import {GenerationTaskArgument} from "common/entities/arguments"
import {GenerationTaskInputData} from "common/entities/generation_task"
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

	const args = {...task.arguments}

	const promptStr = (args["prompt"] + "") ?? "" // TODO: cringe
	const prompt = decomposePrompt(promptStr, allKnownShapeTags() ?? [], Object.keys(allKnownContentTags() ?? {}))
	delete args["prompt"]

	currentParamSetName(task.paramSetName)
	currentShapeTag(prompt.shape)
	currentPrompt(prompt.body)
	currentContentTags(prompt.content)


	// legacy naming
	if("lores" in args){
		args["loras"] = args["lores"]
		delete args["lores"]
	}

	const nonLoadableParamNames: string[] = []
	const boxMap = currentArgumentBoxes()
	for(const [key, value] of Object.entries(args)){
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