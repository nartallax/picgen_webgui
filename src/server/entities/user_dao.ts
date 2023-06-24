import {User} from "common/entities/user"
import {ApiError} from "common/infra_entities/api_error"
import {getHttpContext} from "server/context"
import {DAO} from "server/dao"
import {DiscordApiAccessTokenResponse, DiscordApiUser} from "server/discord_api_client"
import {config, context, discordApi} from "server/server_globals"
import {unixtime} from "server/utils/unixtime"

export interface ServerUser extends User {
	discordAccessToken: string | null
	discordRefreshToken: string | null
	discordTokenExpiresAt: number | null
}

const timeMarginBeforeRenewal = 15 * 60

export class UserDAO extends DAO<ServerUser> {

	readonly discordTokenCookieName = "picgen-bot-discord-token"

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
		return !config.userControl || user.isAdmin
	}

	isAllowed(user: ServerUser): boolean {
		return !config.userControl || user.isAllowed
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

	setDiscordCookieToken(user: ServerUser): void {
		if(!user.discordAccessToken){
			throw new Error("Cannot send discord access token to client: it's empty!")
		}
		getHttpContext().cookie.set(this.discordTokenCookieName, user.discordAccessToken)
	}

	deleteDiscordCookieToken(): void {
		getHttpContext().cookie.delete(this.discordTokenCookieName)
	}

	async maybeUpdateDiscordTokenProps(user: ServerUser): Promise<void> {
		if(!user.discordRefreshToken || !user.discordTokenExpiresAt){
			return
		}
		if(user.discordTokenExpiresAt - timeMarginBeforeRenewal > unixtime()){
			return
		}
		const token = await discordApi.getTokenByRefreshToken(user.discordRefreshToken)
		this.setDiscordTokenProps(user, token)
	}

	// TODO: think about updating current user; this may lead to inconsistencies
	private currentUserCacheKey = "current-user"
	private getCachedCurrentUser(): ServerUser | null | undefined {
		return context.get().cache[this.currentUserCacheKey] as ServerUser | null | undefined
	}
	private setCachedCurrentUser(user: ServerUser | null): void {
		context.get().cache[this.currentUserCacheKey] = user
	}

	async queryCurrent(): Promise<ServerUser | null> {
		let currentUser = this.getCachedCurrentUser()
		if(currentUser !== undefined){
			return currentUser
		}
		const cookie = getHttpContext().cookie.get(this.discordTokenCookieName)
		if(!cookie){
			currentUser = null
		} else {
			currentUser = await this.queryByFieldValue("discordAccessToken", cookie)
		}
		this.setCachedCurrentUser(currentUser)
		return currentUser
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