import {ApiError} from "common/api_error"
import {ApiResponse, isSuccessApiResponse} from "common/common_types"

export class ApiClient {

	constructor(readonly urlBase: string) {}

	async call(name: string, input: unknown): Promise<unknown> {
		const resp = await fetch(this.urlBase + name, {
			method: "POST",
			body: JSON.stringify(input)
		})

		const respData: ApiResponse<unknown> = await resp.json()

		if(isSuccessApiResponse(respData)){
			return respData.result
		} else {
			throw new ApiError(respData.error.type, respData.error.message)
		}
	}

}