import {ApiClient} from "client/app/api_client"
import {GenParameterDefinition} from "common/common_types"

export namespace ClientApi {

	const client = new ApiClient("/api/")

	export const getGenerationParameterDefinitions = () =>
		client.call("getGenerationParameterDefinitions", {}) as Promise<readonly GenParameterDefinition[]>

	export const getShapeTags = () =>
		client.call("getShapeTags", {}) as Promise<readonly string[]>

	export const getContentTags = () =>
		client.call("getContentTags", {}) as Promise<{readonly [tagContent: string]: readonly string[]}>

}