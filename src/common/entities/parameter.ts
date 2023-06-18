import {RC} from "@nartallax/ribcage"
import {GenerationTaskArgument} from "common/entities/arguments"
import {PictureType} from "common/entities/picture"
import {flatten} from "common/utils/flatten"

export function getGenParamDefault(def: GenParameter): GenerationTaskArgument | undefined {
	return "default" in def ? def.default : undefined
}

export function getParamDefList(paramSet: GenerationParameterSet): GenParameter[] {
	return flatten(paramSet.parameterGroups.map(group => group.parameters))
}

type BaseGenParam = RC.Value<typeof BaseGenParam>
const BaseGenParam = RC.struct(RC.structFields({
	ro: {
		jsonName: RC.string(),
		uiName: RC.string()
	},
	roOpt: {
		tooltip: RC.string()
	}
}))

export type FloatGenParam = RC.Value<typeof FloatGenParam>
export const FloatGenParam = RC.struct(RC.structFields({
	ro: {
		type: RC.constant("float"),
		default: RC.number()
	},
	roOpt: {
		min: RC.number(),
		max: RC.number()
	}
}), {}, BaseGenParam)

export type IntGenParam = RC.Value<typeof IntGenParam>
export const IntGenParam = RC.struct(RC.structFields({
	ro: {
		type: RC.constant("int"),
		default: RC.int()
	},
	roOpt: {
		min: RC.int(),
		max: RC.int(),
		step: RC.int()
	}
}), {}, BaseGenParam)

export type BoolGenParam = RC.Value<typeof BoolGenParam>
export const BoolGenParam = RC.roStruct({
	type: RC.constant("bool"),
	default: RC.bool()
}, {}, BaseGenParam)

export type StringGenParam = RC.Value<typeof StringGenParam>
export const StringGenParam = RC.struct(RC.structFields({
	ro: {
		type: RC.constant("string"),
		default: RC.string()
	},
	roOpt: {
		minLength: RC.int(),
		maxLength: RC.int(),
		large: RC.bool()
	}
}), {}, BaseGenParam)

export type PictureGenParam = RC.Value<typeof PictureGenParam>
export const PictureGenParam = RC.struct(RC.structFields({
	ro: {
		type: RC.constant("picture")
	},
	roOpt: {
		allowedTypes: RC.roArray(PictureType),
		maxWidth: RC.int(),
		maxHeight: RC.int(),
		minWidth: RC.int(),
		minHeight: RC.int(),
		sizeStep: RC.int(),
		square: RC.bool(),
		mask: RC.bool()
	}
}), {}, BaseGenParam)

export type EnumGenParam = RC.Value<typeof EnumGenParam>
export const EnumGenParam = RC.struct(RC.structFields({
	ro: {
		type: RC.constant("enum"),
		options: RC.roArray(
			RC.union([
				RC.number(),
				RC.string(),
				RC.roStruct({
					label: RC.string(),
					value: RC.union([
						RC.number(),
						RC.string()
					])
				})
			]),
			{validators: [arr => arr.length > 0]}
		)
	},
	roOpt: {
		searchable: RC.bool()
	}
}), {}, BaseGenParam)

export type JsonFileListGenParam = RC.Value<typeof JsonFileListGenParam>
export const JsonFileListGenParam = RC.struct(RC.structFields({
	ro: {
		type: RC.constant("json_file_list")
	},
	roOpt: {
		siblingFileExtension: RC.string(),
		inputInvitation: RC.string()
	},
	normal: {
		directory: RC.string()
	}
}), {}, BaseGenParam)

export type GenParameter = RC.Value<typeof GenParameter>
export const GenParameter = RC.union([
	FloatGenParam, IntGenParam, StringGenParam, BoolGenParam, PictureGenParam, EnumGenParam, JsonFileListGenParam
])

export type GenParameterGroupToggle = RC.Value<typeof GenParameterGroupToggle>
export const GenParameterGroupToggle = RC.roStruct({
	jsonName: RC.string(),
	default: RC.bool()
})

export type GenParameterGroup = RC.Value<typeof GenParameterGroup>
export const GenParameterGroup = RC.struct(RC.structFields({
	ro: {
		uiName: RC.string(),
		parameters: RC.roArray(GenParameter)
	},
	roOpt: {
		toggle: GenParameterGroupToggle,
		split: RC.bool()
	}
}))

export type GenerationParameterSet = RC.Value<typeof GenerationParameterSet>
export const GenerationParameterSet = RC.roStruct({
	uiName: RC.string(),
	internalName: RC.string(),
	parameterGroups: RC.roArray(GenParameterGroup),
	commandTemplate: RC.string()
})

export function defaultValueOfParam(def: GenParameter | GenParameterGroupToggle): GenerationTaskArgument {
	if(!("type" in def)){
		return def.default
	}

	switch(def.type){
		case "picture":
			return {id: 0, salt: 0}
		case "enum": {
			const opt = def.options[0]!
			if(typeof(opt) === "object"){
				return opt.value
			} else {
				return opt
			}
		}
		case "json_file_list":
			return []
		default: return def.default
	}
}