import {ApiError, ApiErrorType} from "common/infra_entities/api_error"

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

export function errorToErrorApiResp(error: unknown): ErrorApiResponse {
	if(error instanceof ApiError){
		return {error: {type: error.errorType, message: error.message}}
	} else {
		return {error: {type: "generic", message: "Something is borken on the server UwU"}}
	}
}