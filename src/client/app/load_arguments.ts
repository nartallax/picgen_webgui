import {allKnownParamSets, argumentsByParamSet, currentParamSetName} from "client/app/global_values"
import {isParameterLocked} from "client/controls/lock_button/lock_button"
import {showToast} from "client/controls/toast/toast"
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
	const paramSet = allKnownParamSets.get().find(paramSet => paramSet.internalName === task.paramSetName)
	if(!paramSet){
		showToast({
			text: `There's no parameter set ${task.paramSetName} anymore. This task used that parameter set. Cannot load values.`,
			type: "error"
		})
		return
	}

	const args = {...task.arguments}

	currentParamSetName.set(task.paramSetName)

	// legacy naming
	if("lores" in args){
		args["loras"] = args["lores"]
		delete args["lores"]
	}

	const nonLoadableParamNames: string[] = []
	const newArgValues = {...argumentsByParamSet.get()[paramSet.internalName] ?? {}}
	for(const key of Object.keys(args)){
		if(!(key in newArgValues)){
			nonLoadableParamNames.push(key)
			delete newArgValues[key]
			continue
		}

		if(isParameterLocked(paramSet, key)){
			delete args[key]
			continue
		}

		newArgValues[key] = args[key]!
	}
	argumentsByParamSet.set({...argumentsByParamSet.get(), [paramSet.internalName]: newArgValues})

	if(nonLoadableParamNames.length > 0){
		showToast({
			text: `Some of parameters of the task are now non-existent and were not loaded: ${nonLoadableParamNames.join(", ")}`,
			type: "info"
		})
	}
}