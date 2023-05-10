import {User} from "common/entities/user"
import {ApiError} from "common/infra_entities/api_error"
import {DAO} from "server/dao"
import {DiscordApiAccessTokenResponse, DiscordApiUser} from "server/discord_api_client"
import {RequestContext, UserlessContext} from "server/request_context"
import {unixtime} from "server/utils/unixtime"

export interface ServerUser extends User {
	discordAccessToken: string | null
	discordRefreshToken: string | null
	discordId: string | null
	discordTokenExpiresAt: number | null
}

const timeMarginBeforeRenewal = 15 * 60

export class UserlessUserDAO<C extends UserlessContext = UserlessContext> extends DAO<ServerUser, C> {

	setDiscordTokenProps(user: Omit<ServerUser, "id">, token: DiscordApiAccessTokenResponse) {
		user.discordAccessToken = token.access_token
		user.discordRefreshToken = token.refresh_token
		user.discordTokenExpiresAt = unixtime() + token.expires_in
	}

	setDiscordUserProps(user: Omit<ServerUser, "id">, discordUser: DiscordApiUser): void {
		user.avatarUrl = discordUser.avatarUrl
		user.displayName = discordUser.username
		user.discordId = discordUser.id
	}

	makeEmptyUser(): Omit<ServerUser, "id"> {
		return {
			discordAccessToken: null,
			discordRefreshToken: null,
			discordId: null,
			discordTokenExpiresAt: null,
			creationTime: unixtime(),
			displayName: "",
			avatarUrl: ""
		}
	}

	mbGetByDiscordId(discordId: string): Promise<ServerUser | null> {
		return this.mbGetByFieldValue("discordId", discordId)
	}

	protected getTableName(): string {
		return "users"
	}

	stripUserForClient(user: ServerUser): User {
		return {
			avatarUrl: user.avatarUrl,
			displayName: user.displayName,
			creationTime: user.creationTime,
			id: user.id
		}
	}

	clearLoginFields(user: ServerUser): void {
		user.discordAccessToken = null
		user.discordRefreshToken = null
		user.discordTokenExpiresAt = null
	}

}

export class CompleteUserDAO extends UserlessUserDAO<RequestContext> {

	readonly discordTokenCookieName = "picgen-bot-discord-token"
	private currentUser: ServerUser | null | undefined = undefined

	setDiscordCookieToken(user: ServerUser): void {
		if(!user.discordAccessToken){
			throw new Error("Cannot send discord access token to client: it's empty!")
		}
		this.getContext().cookie.set(this.discordTokenCookieName, user.discordAccessToken)
	}

	deleteDiscordCookieToken(): void {
		this.getContext().cookie.delete(this.discordTokenCookieName)
	}

	async maybeUpdateDiscordTokenProps(user: ServerUser): Promise<void> {
		if(!user.discordRefreshToken || !user.discordTokenExpiresAt){
			return
		}
		if(user.discordTokenExpiresAt - timeMarginBeforeRenewal > unixtime()){
			return
		}
		const token = await this.getContext().discordApi.getTokenByRefreshToken(user.discordRefreshToken)
		this.setDiscordTokenProps(user, token)
	}

	async mbGetCurrent(): Promise<ServerUser | null> {
		if(this.currentUser || this.currentUser === null){
			return this.currentUser
		}
		const cookie = this.getContext().cookie.get(this.discordTokenCookieName)
		if(!cookie){
			this.currentUser = null
		} else {
			this.currentUser = await this.mbGetByFieldValue("discordAccessToken", cookie)
		}
		return this.currentUser
	}

	async getCurrent(): Promise<ServerUser> {
		const user = await this.mbGetCurrent()
		if(!user){
			throw new ApiError("not_logged_in", "User is not logged in")
		}
		return user
	}

}