import {GenerationTaskArgument} from "common/entities/arguments"
import {GenParameter, GenParameterGroupToggle, GenerationParameterSet, defaultValueOfParam} from "common/entities/parameter"
import {flatten} from "common/utils/flatten"

type GenParamLike = (GenParameter | GenParameterGroupToggle) & {readonly jsonName: string}
function isGenParamLike(param: GenParameter | GenParameterGroupToggle): param is GenParamLike {
	return typeof((param as GenParamLike).jsonName) === "string"
}

export function fixArgumentMap(args: Record<string, GenerationTaskArgument>, paramSet: GenerationParameterSet): Record<string, GenerationTaskArgument> {
	const groups = paramSet.parameterGroups
	const defs: GenParamLike[] = flatten(groups.map(group => group.parameters))
	for(const group of groups){
		if(group.toggle && isGenParamLike(group.toggle)){
			defs.push(group.toggle)
		}
	}

	let changes = 0
	const newArgs = {...args}
	const unknownNames = new Set(Object.keys(newArgs))
	for(const def of defs){
		if(!(def.jsonName in newArgs)){
			newArgs[def.jsonName] = defaultValueOfParam(def)
			changes++
		}
		unknownNames.delete(def.jsonName)
	}

	for(const unknownName of unknownNames){
		delete newArgs[unknownName]
		changes++
	}

	return changes === 0 ? args : newArgs
}