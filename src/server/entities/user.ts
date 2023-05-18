import {User} from "common/entities/user"
import {ApiError} from "common/infra_entities/api_error"
import {cont} from "server/async_context"
import {DAO} from "server/dao"
import {DiscordApiAccessTokenResponse, DiscordApiUser} from "server/discord_api_client"
import {RequestContext, UserlessContext} from "server/request_context"
import {unixtime} from "server/utils/unixtime"

export interface ServerUser extends User {
	discordAccessToken: string | null
	discordRefreshToken: string | null
	discordTokenExpiresAt: number | null
}

const timeMarginBeforeRenewal = 15 * 60

export class UserlessUserDAO<C extends UserlessContext = UserlessContext> extends DAO<ServerUser, C> {

	protected override fieldFromDb<K extends keyof ServerUser & string>(field: K, value: ServerUser[K]): unknown {
		switch(field){
			case "isAllowed":
			case "isAdmin":
				return !!value // TODO: cringe
			default: return value
		}
	}

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
			...User.getValue(),
			discordAccessToken: null,
			discordRefreshToken: null,
			discordTokenExpiresAt: null,
			creationTime: unixtime()
		}
	}

	queryByDiscordId(discordId: string): Promise<ServerUser | null> {
		return this.queryByFieldValue("discordId", discordId)
	}

	protected getTableName(): string {
		return "users"
	}

	stripUserForClient(user: ServerUser): User {
		return {
			avatarUrl: user.avatarUrl,
			displayName: user.displayName,
			creationTime: user.creationTime,
			id: user.id,
			isAdmin: user.isAdmin,
			isAllowed: user.isAllowed,
			discordId: user.discordId
		}
	}

	clearLoginFields(user: ServerUser): void {
		user.discordAccessToken = null
		user.discordRefreshToken = null
		user.discordTokenExpiresAt = null
	}

	isAdmin(user: ServerUser): boolean {
		return !cont().config.userControl || user.isAdmin
	}

	isAllowed(user: ServerUser): boolean {
		return !cont().config.userControl || user.isAllowed
	}

	checkIsAdmin(user: ServerUser): void {
		if(!this.isAdmin(user)){
			throw new ApiError("permission", "User is not admin")
		}
	}

	checkIsAllowed(user: ServerUser): void {
		if(!this.isAllowed(user)){
			throw new ApiError("permission", "User is not allowed")
		}
	}

	async checkNoDuplicateDiscordId(discordId: string): Promise<void> {
		const user = await this.queryByDiscordId(discordId)
		if(user){
			throw new ApiError("generic", `A user (${user.id}) is already present for this discord ID (${discordId})`)
		}
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

	async queryCurrent(): Promise<ServerUser | null> {
		if(this.currentUser || this.currentUser === null){
			return this.currentUser
		}
		const cookie = this.getContext().cookie.get(this.discordTokenCookieName)
		if(!cookie){
			this.currentUser = null
		} else {
			this.currentUser = await this.queryByFieldValue("discordAccessToken", cookie)
		}
		return this.currentUser
	}

	async getCurrent(): Promise<ServerUser> {
		const user = await this.queryCurrent()
		if(!user){
			throw new ApiError("not_logged_in", "User is not logged in")
		}
		this.checkIsAllowed(user)
		return user
	}

}