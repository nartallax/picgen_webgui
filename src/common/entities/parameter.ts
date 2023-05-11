import {RC} from "@nartallax/ribcage"
import {GenerationTaskArgument} from "common/entities/generation_task"
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
		type: RC.constant("float" as const),
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
		type: RC.constant("int" as const),
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
	type: RC.constant("bool" as const),
	default: RC.bool()
}, {}, BaseGenParam)

export type StringGenParam = RC.Value<typeof StringGenParam>
export const StringGenParam = RC.struct(RC.structFields({
	ro: {
		type: RC.constant("string" as const),
		default: RC.string()
	},
	roOpt: {
		minLength: RC.int(),
		maxLength: RC.int()
	}
}), {}, BaseGenParam)

export type PictureGenParam = RC.Value<typeof PictureGenParam>
export const PictureGenParam = RC.struct(RC.structFields({
	ro: {
		type: RC.constant("picture" as const)
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

export type GenParameter = RC.Value<typeof GenParameter>
export const GenParameter = RC.union([
	FloatGenParam, IntGenParam, StringGenParam, BoolGenParam, PictureGenParam
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
		toggle: GenParameterGroupToggle
	}
}))

export type GenerationParameterSet = RC.Value<typeof GenerationParameterSet>
export const GenerationParameterSet = RC.roStruct({
	uiName: RC.string(),
	internalName: RC.string(),
	parameterGroups: RC.roArray(GenParameterGroup),
	commandTemplate: RC.string()
})