import {ApiClient} from "client/app/api_client"
import {GenParameterDefinition, SimpleListQueryParams} from "common/common_types"
import {GenerationTask, GenerationTaskInputData, Picture, User} from "common/entity_types"

export namespace ClientApi {

	const client = new ApiClient("/api/")

	export const getGenerationParameterDefinitions = () =>
		client.call<readonly GenParameterDefinition[]>("getGenerationParameterDefinitions", {})

	export const getShapeTags = () =>
		client.call<readonly string[]>("getShapeTags", {})

	export const getContentTags = () =>
		client.call<{readonly [tagContent: string]: readonly string[]}>("getContentTags", {})

	export const getDiscordLoginUrl = () =>
		client.call<string>("getDiscordLoginUrl", {})

	export const getUserData = () =>
		client.call<User>("getUserData", {})

	export const logout = () =>
		client.call<void>("logout", {})

	export const createGenerationTask = (inputData: GenerationTaskInputData) =>
		client.call<GenerationTask>("createGenerationTask", {inputData})

	export const listTasks = (inputData: SimpleListQueryParams<GenerationTask>) =>
		client.call<{tasks: GenerationTask[], pictures: Picture[]}>("listTasks", {inputData})

	export const getPictureData = (pictureId: number) =>
		client.callForBinary("getPictureData", {pictureId})

}