import {WBox} from "@nartallax/cardboard"
import {allKnownContentTags, allKnownParamSets, allKnownShapeTags, currentArgumentBoxes, currentContentTags, currentParamSetName, currentPrompt, currentShapeTag} from "client/app/global_values"
import {decomposePrompt} from "client/app/prompt_composing"
import {showToast} from "client/controls/toast/toast"
import {GenerationTaskArgument} from "common/entities/arguments"
import {GenerationTaskInputData} from "common/entities/generation_task"
import {Picture, pictureHasEffectiveArgs} from "common/entities/picture"

export function loadArgumentsFromPicture(picture: Picture, task?: GenerationTaskInputData): void {
	let genInputData: GenerationTaskInputData
	if(pictureHasEffectiveArgs(picture)){
		genInputData = {
			prompt: picture.effectiveArgs.prompt as string, // ew.
			params: {
				...(task?.params ?? {}),
				...picture.effectiveArgs
			},
			paramSetName: picture.paramSetName
		}
		delete genInputData.params!.prompt
	} else if(task){
		genInputData = {...task}
		let modifiedArgs = picture.modifiedArguments
		if(modifiedArgs){
			if("prompt" in modifiedArgs){ // TODO: cringe
				genInputData.prompt = modifiedArgs.prompt + ""
				modifiedArgs = {...modifiedArgs}
				delete modifiedArgs.prompt
			}
			genInputData.params = {...genInputData.params, ...modifiedArgs}
		}
	} else {
		throw new Error("Cannot load arguments from picture: there's no attached effective args, and there's no task.")
	}

	loadArguments(genInputData)
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


	const prompt = decomposePrompt(task.prompt, allKnownShapeTags() ?? [], Object.keys(allKnownContentTags() ?? {}))

	currentParamSetName(task.paramSetName)
	currentShapeTag(prompt.shape)
	currentPrompt(prompt.body)
	currentContentTags(prompt.content)

	const nonLoadableParamNames: string[] = []
	for(const [key, value] of Object.entries(task.params)){
		const argBox = currentArgumentBoxes[key]
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