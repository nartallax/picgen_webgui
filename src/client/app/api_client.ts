import {ApiResponse, isSuccessApiResponse} from "common/infra_entities/api"
import {ApiError} from "common/infra_entities/api_error"

export class ApiClient {

	constructor(readonly urlBase: string, readonly onApiError?: (err: ApiError) => void) {}

	private post(name: string, input: unknown): Promise<Response> {
		return fetch(this.urlBase + name, {
			method: "POST",
			body: JSON.stringify(input)
		})
	}

	private put(name: string, body: ArrayBuffer, params: Record<string, string>): Promise<Response> {
		let queryStr = Object.entries(params).map(([k, v]) => {
			return encodeURIComponent(k) + "=" + encodeURIComponent(v)
		}).join("&")
		if(queryStr){
			queryStr = "?" + queryStr
		}

		// TODO: rewrite to XHR, for sake of progress event
		return fetch(this.urlBase + name + queryStr, {
			method: "PUT",
			body: body
		})
	}

	private get(name: string, params: Record<string, string>): Promise<Response> {
		let queryStr = Object.entries(params).map(([k, v]) => {
			return encodeURIComponent(k) + "=" + encodeURIComponent(v)
		}).join("&")
		if(queryStr){
			queryStr = "?" + queryStr
		}

		return fetch(this.urlBase + name + queryStr, {method: "GET"})
	}

	private async parseResp<T>(resp: Response): Promise<T> {
		const respData: ApiResponse<unknown> = await resp.json()

		if(isSuccessApiResponse(respData)){
			return respData.result as T
		} else {
			const err = new ApiError(respData.error.type, respData.error.message)
			if(this.onApiError){
				this.onApiError(err)
			}
			throw err
		}
	}

	async callForBinary(name: string, input: unknown): Promise<ArrayBuffer> {
		const resp = await this.post(name, input)
		return await resp.arrayBuffer()
	}

	async call<T>(name: string, input: unknown): Promise<T> {
		const resp = await this.post(name, input)
		return await this.parseResp(resp)
	}

	async callPut<T>(name: string, data: ArrayBuffer, input: Record<string, string>): Promise<T> {
		const resp = await this.put(name, data, input)
		return await this.parseResp(resp)
	}

	async callGetForBinary(name: string, input: Record<string, string>): Promise<ArrayBuffer> {
		const resp = await this.get(name, input)
		return await resp.arrayBuffer()
	}

}