import {ApiClient} from "client/app/api_client"
import {GenParameterDefinition} from "common/common_types"
import {User} from "common/entity_types"

export namespace ClientApi {

	const client = new ApiClient("/api/")

	export const getGenerationParameterDefinitions = () =>
		client.call("getGenerationParameterDefinitions", {}) as Promise<readonly GenParameterDefinition[]>

	export const getShapeTags = () =>
		client.call("getShapeTags", {}) as Promise<readonly string[]>

	export const getContentTags = () =>
		client.call("getContentTags", {}) as Promise<{readonly [tagContent: string]: readonly string[]}>

	export const getDiscordLoginUrl = () =>
		client.call("getDiscordLoginUrl", {}) as Promise<string>

	export const getUserData = () =>
		client.call("getUserData", {}) as Promise<User>

	export const logout = () =>
		client.call("logout", {}) as Promise<void>

}