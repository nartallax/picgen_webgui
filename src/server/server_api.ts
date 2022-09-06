import {GenParameterDefinition, SimpleListQueryParams} from "common/common_types"
import {ApiError} from "common/api_error"
import {cont} from "server/async_context"
import {config} from "server/config"
import {GenerationTask, GenerationTaskInputData, Picture, User} from "common/entity_types"

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

	export function getDiscordLoginUrl(): string {
		return config.discordLoginUrl
	}

	export async function discordOauth2(): Promise<void> {
		const context = cont()
		const accessCode = context.requestUrl.searchParams.get("code")
		if(!accessCode){
			throw new ApiError("generic", "No code!")
		}
		const redirectUrl = new URL(context.requestUrl)
		redirectUrl.search = ""
		// why TF this works, but just `/` does not?
		// I don't understand this API
		redirectUrl.pathname = "/api/" + discordOauth2.name

		const token = await context.discordApi.getTokenByCode(accessCode, redirectUrl + "")
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

	export async function listTasks(query: SimpleListQueryParams<GenerationTask>): Promise<{tasks: GenerationTask[], pictures: Picture[]}> {
		const context = cont()
		const tasks = await context.generationTask.list(query)
		const serverPictures = await context.picture.queryAllFieldIncludes("generationTaskId", tasks.map(x => x.id))
		const pictures = serverPictures.map(pic => context.picture.stripServerData(pic))
		return {tasks, pictures}
	}

	export async function getPictureData(pictureId: number): Promise<Buffer> {
		return await cont().picture.getPictureData(pictureId)
	}

}