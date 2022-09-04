import {ApiErrorType} from "common/common_types"

export class ApiError extends Error {
	constructor(readonly errorType: ApiErrorType, message: string) {
		super(message)
	}
}