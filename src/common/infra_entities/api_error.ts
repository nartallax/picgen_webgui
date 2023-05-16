export type ApiErrorType = "generic" | "not_logged_in" | "misconfiguration" | "access_denied" | "validation_not_passed" | "permission"

export class ApiError extends Error {
	readonly isApiError = true

	constructor(readonly errorType: ApiErrorType, message: string) {
		super(message)
	}

	static isApiError(x: unknown): x is ApiError {
		return !!x && typeof(x) === "object" && (x as ApiError).isApiError === true
	}
}