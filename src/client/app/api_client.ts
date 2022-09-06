import {ApiError} from "common/api_error"
import {ApiResponse, isSuccessApiResponse} from "common/common_types"

export class ApiClient {

	constructor(readonly urlBase: string) {}

	private post(name: string, input: unknown): Promise<Response> {
		return fetch(this.urlBase + name, {
			method: "POST",
			body: JSON.stringify(input)
		})
	}

	async callForBinary(name: string, input: unknown): Promise<ArrayBuffer> {
		const resp = await this.post(name, input)
		return await resp.arrayBuffer()
	}

	async call<T>(name: string, input: unknown): Promise<T> {
		const resp = await this.post(name, input)

		const respData: ApiResponse<unknown> = await resp.json()

		if(isSuccessApiResponse(respData)){
			return respData.result as T
		} else {
			throw new ApiError(respData.error.type, respData.error.message)
		}
	}

}