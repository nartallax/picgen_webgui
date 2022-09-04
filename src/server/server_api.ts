import {GenParameterDefinition} from "common/common_types"
import {ApiError} from "common/api_error"
import {cont} from "server/async_context"
import {config} from "server/config"
import {User} from "common/entity_types"

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
			cont().redirectUrl = "/"
			return
		}
		const redirectUrl = new URL(context.requestUrl)
		redirectUrl.search = ""
		// why TF this works, but just `/` does not?
		// I don't understand this API
		redirectUrl.pathname = "/api/discordOauth2"

		const token = await context.discordApi.getTokenByCode(accessCode, redirectUrl + "")
		const discordUser = await context.discordApi.getCurrentUser(token.access_token)
		let user = await context.user.mbGetByDiscordId(discordUser.id)
		if(user){
			context.user.setDiscordTokenProps(user, token)
			await context.user.update(user)
		} else {
			user = await context.user.create(context.user.makeUser(token, discordUser))
		}

		context.user.setDiscordCookieToken(user)
		context.redirectUrl = "/"
	}

	export async function getUserData(): Promise<User> {
		const context = cont()
		const user = await context.user.getCurrent()
		await context.user.maybeRenewAccessToken(user)
		if(!user.discordAccessToken){
			throw new ApiError("not_logged_in", "User is not logged in.")
		}
		const discordUser = await context.discordApi.getCurrentUser(user.discordAccessToken)
		return context.user.makeClientUser(user, discordUser)
	}

	export async function logout(): Promise<void> {
		const context = cont()
		const user = await context.user.getCurrent()
		context.user.clearLoginFields(user)
		await context.user.update(user)
		context.user.deleteDiscordCookieToken()
	}

}