import {ApiClient} from "client/app/api_client"
import {showToast} from "client/controls/toast/toast"
import {GenerationTask, GenerationTaskInputData, GenerationTaskWithPictures} from "common/entities/generation_task"
import {JsonFileList} from "common/entities/json_file_list"
import {GenerationParameterSet} from "common/entities/parameter"
import {Picture, PictureWithTask} from "common/entities/picture"
import {User} from "common/entities/user"
import {SimpleListQueryParams} from "common/infra_entities/query"

export namespace ClientApi {

	const apiPrefix = "/api/"

	const client = new ApiClient(apiPrefix, err => showToast({text: err.message, type: "error"}))

	export const getGenerationParameterSets = () =>
		client.call<GenerationParameterSet[]>("getGenerationParameterSets", {})

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

	export const killOwnTask = (id: number) =>
		client.call<void>("killOwnTask", {id})

	export function getPictureUrl(id: number, salt: number): string {
		return `${apiPrefix}getPictureData?id=${id}&salt=${salt}`
	}

	export function getPictureThumbnails(pictures: Picture[]): Promise<ArrayBuffer> {
		return client.callGetForBinary("getPictureThumbnails", {
			idsAndSalts: pictures.map(pic => pic.id + "." + pic.salt).join("_")
		})
	}

	export function getUserStaticPictureUrl(name: string): string {
		return `${apiPrefix}getUserStaticPicture?name=${encodeURIComponent(name)}`
	}

	export const getUserStaticNames = () => client.call<string[]>("getUserStaticNames", {})

	export function getUserStaticThumbnails(): Promise<ArrayBuffer> {
		return client.callGetForBinary("getUserStaticThumbnails", {})
	}

	export const getPictureInfoById = (id: number, salt: number) =>
		client.call<Picture>("getPictureInfoById", {id, salt})

	export const uploadPictureAsArgument = (paramSetName: string, paramName: string, fileName: string, data: ArrayBuffer) =>
		client.callPut<Picture>("uploadPictureAsArgument", data, {paramSetName, paramName, fileName})

	export const deleteTask = (taskId: number) =>
		client.call<void>("deleteTask", {taskId})

	export const adminListUsers = (query: SimpleListQueryParams<User>) =>
		client.call<User[]>("adminListUsers", {query})

	export const adminUpdateUser = (user: User) =>
		client.call<void>("adminUpdateUser", {user})

	export const adminListTasks = (query: SimpleListQueryParams<GenerationTask>) =>
		client.call<GenerationTask[]>("adminListTasks", {query})

	export const getIsUserControlEnabled = () =>
		client.call<boolean>("getIsUserControlEnabled", {})

	export const adminKillTask = (taskId: number) =>
		client.call<void>("adminKillTask", {taskId})

	export const adminKillAllQueuedTasks = () =>
		client.call<void>("adminKillAllQueuedTasks", {})

	export const adminKillAllQueuedAndRunningTasks = () =>
		client.call<void>("adminKillAllQueuedAndRunningTasks", {})

	export const adminKillCurrentAndPauseQueue = () =>
		client.call<void>("adminKillCurrentAndPauseQueue", {})

	export const adminPauseQueue = () =>
		client.call<void>("adminPauseQueue", {})

	export const adminUnpauseQueue = () =>
		client.call<void>("adminUnpauseQueue", {})

	export const adminReorderQueuedTasks = (taskIds: number[]) =>
		client.call<{id: number, runOrder: number}[]>("adminReorderQueuedTasks", {taskIds})

	export const getIsQueuePaused = () =>
		client.call<boolean>("getIsQueuePaused", {})

	export const setPictureFavorite = (pictureId: number, isFavorite: boolean) =>
		client.call<boolean>("setPictureFavorite", {pictureId, isFavorite})

	export const listPicturesWithTasks = (query: SimpleListQueryParams<Picture>) =>
		client.call<PictureWithTask[]>("listPicturesWithTasks", {query})

	export const getAllJsonFileLists = () =>
		client.call<readonly JsonFileList[]>("getAllJsonFileLists", {})

	export const deletePicture = (pictureId: number) =>
		client.call<void>("deletePicture", {pictureId})

	export const setTaskNote = (taskId: number, note: string) =>
		client.call<void>("setTaskNote", {taskId, note})

	export const searchTasks = (query: string, pageSize: number, minKnownTaskId: number | null) =>
		client.call<GenerationTaskWithPictures[]>("searchTasks", {query, pageSize, minKnownTaskId})

}