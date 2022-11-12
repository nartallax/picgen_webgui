import {GenParameterDefinition, SimpleListQueryParams} from "common/common_types"
import {ApiError} from "common/api_error"
import {cont} from "server/async_context"
import {config} from "server/config"
import {GenerationTask, GenerationTaskInputData, GenerationTaskWithPictures, Picture, PictureInfo, User} from "common/entity_types"

export namespace ServerApi {

	export function getGenerationParameterDefinitions(): readonly GenParameterDefinition[] {
		return config.generationParameters
	}

	export function getShapeTags(): readonly string[] {
		return config.tags.shape
	}

	export function getContentTags(): {readonly [tagContent: string]: readonly string[]} {
		return config.tags.content
	}

	export function getDiscordLoginUrl(protocol: "http" | "https", domain: string): string {
		const str = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(config.discordClientId)}&redirect_uri=${encodeURIComponent(`${protocol}://${domain}/api/discordOauth2`)}&response_type=code&scope=identify`
		return str
	}

	export async function discordOauth2(code: string): Promise<void> {
		const context = cont()
		const redirectUrl = new URL(context.requestUrl)
		redirectUrl.search = ""
		// why TF this works, but just `/` does not?
		// I don't understand this API
		redirectUrl.pathname = "/api/" + discordOauth2.name

		const token = await context.discordApi.getTokenByCode(code, redirectUrl + "")
		const discordUser = await context.discordApi.getCurrentUser(token.access_token)
		let user = await context.user.mbGetByDiscordId(discordUser.id)
		if(user){
			context.user.setDiscordTokenProps(user, token)
			context.user.setDiscordUserProps(user, discordUser)
			await context.user.update(user)
		} else {
			const userWithoutId = context.user.makeEmptyUser()
			context.user.setDiscordTokenProps(userWithoutId, token)
			context.user.setDiscordUserProps(userWithoutId, discordUser)
			user = await context.user.create(userWithoutId)
		}

		context.user.setDiscordCookieToken(user)
		context.redirectUrl = "/"
	}

	export async function getUserData(): Promise<User> {
		const context = cont()
		const user = await context.user.getCurrent()
		await context.user.maybeUpdateDiscordTokenProps(user)
		if(!user.discordAccessToken){
			throw new ApiError("not_logged_in", "User is not logged in.")
		}

		// it's not the best idea to do it here
		// but we should update this data at some point, right?
		const discordUser = await context.discordApi.getCurrentUser(user.discordAccessToken)
		context.user.setDiscordUserProps(user, discordUser)
		await context.user.update(user)

		context.user.setDiscordCookieToken(user)
		return context.user.stripUserForClient(user)
	}

	export async function logout(): Promise<void> {
		const context = cont()
		const user = await context.user.getCurrent()
		context.user.clearLoginFields(user)
		await context.user.update(user)
		context.user.deleteDiscordCookieToken()
	}

	export async function createGenerationTask(inputData: GenerationTaskInputData): Promise<GenerationTask> {
		return await cont().taskQueue.addToQueue(inputData)
	}

	export async function listTasks(query: SimpleListQueryParams<GenerationTask>): Promise<GenerationTaskWithPictures[]> {
		const context = cont()
		const tasks = await context.generationTask.list(query)
		const serverPictures = await context.picture.queryAllFieldIncludes("generationTaskId", tasks.map(x => x.id))
		const pictures = serverPictures.map(pic => context.picture.stripServerData(pic))
		const taskMap = new Map<number, GenerationTaskWithPictures>(tasks.map(task => [task.id, {...task, pictures: []}]))
		for(const picture of pictures){
			const task = taskMap.get(picture.generationTaskId!)!
			task.pictures.push(picture)
		}
		const result = [...taskMap.values()]
		for(const task of result){
			task.pictures.sort((a, b) => a.creationTime - b.creationTime)
		}
		return result
	}

	// actually number expected, string is for calling this stuff through HTTP GET
	export async function getPictureData(id: number | string): Promise<Buffer> {
		const context = cont()
		const pictureId = typeof(id) === "string" ? parseInt(id) : id
		if(Number.isNaN(pictureId)){
			throw new ApiError("generic", "Bad picture ID: " + id)
		}

		const picture = await context.picture.getById(pictureId)
		context.responseHeaders["Content-Type"] = "image/" + (picture.ext === "jpg" ? "jpeg" : picture.ext)

		// TODO: stream directly into http stream?
		const result = await context.picture.getPictureData(picture)
		return result
	}

	export async function getPictureInfoById(id: number): Promise<Picture & PictureInfo> {
		const context = cont()
		const picture = await context.picture.getById(id)
		const info = await context.picture.getPictureInfo(picture)
		const strippedPicture = context.picture.stripServerData(picture)
		return {
			...strippedPicture,
			...info
		}
	}

	export async function killTask(id: number): Promise<void> {
		const context = cont()
		await context.taskQueue.kill(id)
	}

	export async function uploadPictureAsParameterValue(paramName: string, fileName: string, data: unknown): Promise<Picture> {
		if(!(data instanceof Buffer)){
			throw new Error("Data is not buffer!")
		}

		const context = cont()
		const paramDef = context.config.generationParameters.find(def => def.jsonName === paramName)
		if(!paramDef){
			throw new ApiError("validation_not_passed", "Unknown parameter name: " + paramName)
		}
		if(paramDef.type !== "picture"){
			throw new ApiError("validation_not_passed", `Parameter ${paramName} is not picture parameter, it's ${paramDef.type} parameter. You cannot upload a picture as this parameter value.`)
		}

		const pictureInfo = await context.generationTask.validateInputPicture(data, paramDef)
		const user = await context.user.getCurrent()
		const serverPic = await context.picture.storeExternalPicture(data, user.id, fileName, pictureInfo.ext)
		return context.picture.stripServerData(serverPic)
	}

}