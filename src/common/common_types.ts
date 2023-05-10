import {RC} from "@nartallax/ribcage"
import {ApiErrorType} from "common/api_error"
import {GenerationTask, GenerationTaskParameterValue, Picture} from "common/entity_types"
import {flatten} from "common/flatten"
import {RCise} from "common/rcise"

// TODO: move this stuff in like 5 other files, this file is a mess

const pictureTypeArr = ["gif", "png", "jpg", "webp", "bmp", "tiff", "svg", "psd", "ico", "avif", "heic", "heif"] as const
export type PictureType = RC.Value<typeof PictureType>
export const PictureType = RC.constUnion(pictureTypeArr)

export const pictureTypeSet: ReadonlySet<PictureType> = new Set(pictureTypeArr)

export type Point2D = RC.Value<typeof Point2D>
export const Point2D = RC.struct({x: RC.number(), y: RC.number()})
export type Polygon = RC.Value<typeof Polygon>
export const Polygon = RC.array(Point2D)
export type PictureMask = RC.Value<typeof PictureMask>
export const PictureMask = RC.array(Polygon)

export interface SuccessApiResponse<T> {
	result: T
}

export interface ErrorApiResponse {
	error: {
		type: ApiErrorType
		message: string
	}
}

export type ApiResponse<T> = SuccessApiResponse<T> | ErrorApiResponse

export function isSuccessApiResponse(resp: ApiResponse<unknown>): resp is SuccessApiResponse<unknown> {
	return "result" in resp
}

export interface ApiNotificationWrap {
	notification: ApiNotification
}

export type ApiNotification = TaskMessageNotification
| TaskExpectedPictureCountKnownNotification
| TaskPromptUpdatedNotification
| TaskGeneratedPictureNotification
| TaskFinishedNotification
| TaskStartedNotification
| TaskCreatedNotification

export interface TaskMessageNotification {
	type: "task_message"
	taskId: number
	messageType: "error" | "info"
	message: string
}

export interface TaskExpectedPictureCountKnownNotification {
	type: "task_expected_picture_count_known"
	taskId: number
	expectedPictureCount: number
}

export interface TaskPromptUpdatedNotification {
	type: "task_prompt_updated"
	taskId: number
	prompt: string
}

export interface TaskGeneratedPictureNotification {
	type: "task_generated_picture"
	taskId: number
	picture: Picture
	generatedPictures: number
}

export interface TaskFinishedNotification {
	type: "task_finished"
	taskId: number
	finishTime: number
}

export interface TaskStartedNotification {
	type: "task_started"
	taskId: number
	startTime: number
}

export interface TaskCreatedNotification {
	type: "task_created"
	task: GenerationTask
}

export type FilterField<T extends Record<string, unknown>> = RC.Value<ReturnType<typeof FilterField<RC.FieldsOf<RCise<T>>>>>
export const FilterField = <F extends RC.StructFields>(itemType: RC.Struct<F>) => RC.struct({
	field: RC.keyOf(itemType)
})

export type FilterConstantValue = RC.Value<typeof FilterConstantValue>
export const FilterConstantValue = RC.struct({
	value: RC.union([RC.string(), RC.number()])
})

export type FilterValue<T extends Record<string, unknown>> = RC.Value<ReturnType<typeof FilterValue<RC.FieldsOf<RCise<T>>>>>
export const FilterValue = <F extends RC.StructFields>(itemType: RC.Struct<F>) => RC.union([
	FilterConstantValue,
	FilterField(itemType)
])


const filterOpsArray = [">", ">=", "<", "<=", "="] as const

type FilterOp = RC.Value<typeof FilterOp>
const FilterOp = RC.union(filterOpsArray.map(x => RC.constant(x)))
export const allowedFilterOps = new Set(filterOpsArray) as ReadonlySet<FilterOp>

export type BinaryQueryCondition<T extends Record<string, unknown>> = RC.Value<ReturnType<typeof BinaryQueryCondition<RC.FieldsOf<RCise<T>>>>>
export const BinaryQueryCondition = <F extends RC.StructFields>(itemType: RC.Struct<F>) => RC.struct({
	a: FilterValue(itemType),
	b: FilterValue(itemType),
	op: FilterOp
})

export type SimpleListQueryParams<T extends Record<string, unknown>> = RC.Value<ReturnType<typeof SimpleListQueryParams<RC.FieldsOf<RCise<T>>>>>
export const SimpleListQueryParams = <F extends RC.StructFields>(itemType: RC.Struct<F>) => RC.struct(RC.structFields({opt: {
	sortBy: RC.keyOf(itemType),
	filters: RC.array(BinaryQueryCondition(itemType)),
	desc: RC.bool(),
	offset: RC.number(),
	limit: RC.number()
}}))

export function getGenParamDefault(def: GenParameterDefinition): GenerationTaskParameterValue | undefined {
	return "default" in def ? def.default : undefined
}

export function getParamDefList(paramSet: GenerationParameterSet): GenParameterDefinition[] {
	return flatten(paramSet.parameterGroups.map(group => group.parameters))
}

export type GenParameterGroupToggle = RC.Value<typeof GenParameterGroupToggle>
export const GenParameterGroupToggle = RC.roStruct({
	jsonName: RC.string(),
	default: RC.bool()
})

type BaseParamDefinition = RC.Value<typeof BaseParamDefinition>
const BaseParamDefinition = RC.struct(RC.structFields({
	ro: {
		jsonName: RC.string(),
		uiName: RC.string()
	},
	roOpt: {
		tooltip: RC.string()
	}
}))

export type FloatGenParamDefinition = RC.Value<typeof FloatGenParamDefinition>
export const FloatGenParamDefinition = RC.struct(RC.structFields({
	ro: {
		type: RC.constant("float" as const),
		default: RC.number()
	},
	roOpt: {
		min: RC.number(),
		max: RC.number()
	}
}), {}, BaseParamDefinition)

export type IntGenParamDefinition = RC.Value<typeof IntGenParamDefinition>
export const IntGenParamDefinition = RC.struct(RC.structFields({
	ro: {
		type: RC.constant("int" as const),
		default: RC.int()
	},
	roOpt: {
		min: RC.int(),
		max: RC.int(),
		step: RC.int()
	}
}), {}, BaseParamDefinition)

export type BoolGenParamDefinition = RC.Value<typeof BoolGenParamDefinition>
export const BoolGenParamDefinition = RC.roStruct({
	type: RC.constant("bool" as const),
	default: RC.bool()
}, {}, BaseParamDefinition)

export type StringGenParamDefinition = RC.Value<typeof StringGenParamDefinition>
export const StringGenParamDefinition = RC.struct(RC.structFields({
	ro: {
		type: RC.constant("string" as const),
		default: RC.string()
	},
	roOpt: {
		minLength: RC.int(),
		maxLength: RC.int()
	}
}), {}, BaseParamDefinition)

export type PictureGenParamDefinition = RC.Value<typeof PictureGenParamDefinition>
export const PictureGenParamDefinition = RC.struct(RC.structFields({
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
}), {}, BaseParamDefinition)

export type GenParameterDefinition = RC.Value<typeof GenParameterDefinition>
export const GenParameterDefinition = RC.union([
	FloatGenParamDefinition, IntGenParamDefinition, StringGenParamDefinition, BoolGenParamDefinition, PictureGenParamDefinition
])

export type GenParameterGroup = RC.Value<typeof GenParameterGroup>
export const GenParameterGroup = RC.struct(RC.structFields({
	ro: {
		uiName: RC.string(),
		parameters: RC.roArray(GenParameterDefinition)
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