import {ErrorApiResponse} from "common/common_types"

export type ApiErrorType = "generic" | "not_logged_in" | "misconfiguration" | "access_denied" | "validation_not_passed"

export class ApiError extends Error {
	readonly isApiError = true

	constructor(readonly errorType: ApiErrorType, message: string) {
		super(message)
	}

	static isApiError(x: unknown): x is ApiError {
		return !!x && typeof(x) === "object" && (x as ApiError).isApiError === true
	}
}

export function errorToErrorApiResp(error: unknown): ErrorApiResponse {
	if(error instanceof ApiError){
		return {error: {type: error.errorType, message: error.message}}
	} else {
		return {error: {type: "generic", message: "Something is borken on the server UwU"}}
	}
}