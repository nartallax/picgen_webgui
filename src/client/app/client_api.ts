import {ApiClient} from "client/app/api_client"
import {showToast} from "client/controls/toast/toast"
import {GenerationParameterSet, SimpleListQueryParams} from "common/common_types"
import {GenerationTask, GenerationTaskInputData, GenerationTaskWithPictures, Picture, PictureInfo, User} from "common/entity_types"

export namespace ClientApi {

	const apiPrefix = "/api/"

	const client = new ApiClient(apiPrefix, err => showToast({text: err.message, type: "error"}))

	export const getGenerationParameterSets = () =>
		client.call<GenerationParameterSet[]>("getGenerationParameterSets", {})

	export const getShapeTags = () =>
		client.call<readonly string[]>("getShapeTags", {})

	export const getContentTags = () =>
		client.call<{readonly [tagContent: string]: readonly string[]}>("getContentTags", {})

	export const getDiscordLoginUrl = (protocol: "http" | "https", domain: string) =>
		client.call<string>("getDiscordLoginUrl", {protocol, domain})

	export const getUserData = () =>
		client.call<User>("getUserData", {})

	export const logout = () =>
		client.call<void>("logout", {})

	export const createGenerationTask = (inputData: GenerationTaskInputData) =>
		client.call<GenerationTask>("createGenerationTask", {inputData})

	export const listTasks = (query: SimpleListQueryParams<GenerationTask>) =>
		client.call<GenerationTaskWithPictures[]>("listTasks", {query})

	export const killTask = (id: number) =>
		client.call<void>("killTask", {id})

	export function getPictureUrl(id: number): string {
		return `${apiPrefix}getPictureData?id=${id}`
	}

	export const getPictureInfoById = (id: number) =>
		client.call<Picture & PictureInfo>("getPictureInfoById", {id})

	export const uploadPictureAsParameterValue = (paramSetName: string, paramName: string, fileName: string, data: ArrayBuffer) =>
		client.callPut<Picture>("uploadPictureAsParameterValue", data, {paramSetName, paramName, fileName})

	// export const getPictureData = (pictureId: number) =>
	// 	client.callForBinary("getPictureData", {pictureId})

}