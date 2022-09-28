import {ApiErrorType} from "common/api_error"
import {GenerationTask, Picture} from "common/entity_types"

/** Without this value, this file is not included in bundle
 * Therefore, runtyper cannot use types from it, which is bad */
export const justForRuntyper = "nya"

export type GenParameterDefinition = FloatGenParamDefinition | IntGenParamDefinition | BoolGenParamDefinition

interface BaseParamDefinition {
	readonly jsonName: string
	readonly uiName: string
	readonly isTest?: boolean
}

export interface FloatGenParamDefinition extends BaseParamDefinition {
	readonly type: "float"
	readonly default: number
	readonly min?: number
	readonly max?: number
}

export interface IntGenParamDefinition extends BaseParamDefinition {
	readonly type: "int"
	readonly default: number
	readonly min?: number
	readonly max?: number
	readonly step?: number
}

export interface BoolGenParamDefinition extends BaseParamDefinition {
	readonly type: "bool"
	readonly default: boolean
}

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

export interface FilterField<T> {
	field: keyof T
}

export interface FilterConstantValue {
	value: string | number
}

export type FilterValue<T> = FilterConstantValue | FilterField<T>

// this is declared this way mostly due to Runtyper being too stupid to understand simplier notations
const _allowedOpsObj = {
	">": true,
	">=": true,
	"<": true,
	"<=": true,
	"=": true
}
type FilterOps = keyof typeof _allowedOpsObj
export const allowedFilterOps = new Set(Object.keys(_allowedOpsObj)) as ReadonlySet<FilterOps>

export interface BinaryQueryCondition<T> {
	a: FilterValue<T>
	b: FilterValue<T>
	op: FilterOps
}

export interface SimpleListQueryParams<T>{
	sortBy: keyof T & string
	filters?: BinaryQueryCondition<T>[]
	desc: boolean
	offset: number
	limit: number
}