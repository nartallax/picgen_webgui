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

export type ApiErrorType = "generic" | "not_logged_in"

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

export interface ApiNotification<T> {
	notification: T
}