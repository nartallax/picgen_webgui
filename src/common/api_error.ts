import {ErrorApiResponse} from "common/common_types"

export type ApiErrorType = "generic" | "not_logged_in" | "misconfiguration" | "access_denied" | "validation_not_passed"

export class ApiError extends Error {
	constructor(readonly errorType: ApiErrorType, message: string) {
		super(message)
	}
}

export function errorToErrorApiResp(error: unknown): ErrorApiResponse {
	if(error instanceof ApiError){
		return {error: {type: error.errorType, message: error.message}}
	} else {
		return {error: {type: "generic", message: "Something is borken on the server UwU"}}
	}
}