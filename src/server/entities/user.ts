import {ApiError} from "common/api_error"
import {User} from "common/entity_types"
import {DAO} from "server/dao"
import {DbConnection} from "server/db_controller"
import {DiscordApiAccessTokenResponse, DiscordApiClient, DiscordApiUser} from "server/discord_api_client"
import {CookieController} from "server/http/cookie_controller"
import {unixtime} from "server/utils/unixtime"

export interface ServerUser extends Omit<User, "avatarUrl"> {
	discordAccessToken: string | null
	discordRefreshToken: string | null
	discordId: string | null
	discordTokenExpiresAt: number | null
}

const timeMarginBeforeRenewal = 15 * 60

export class UserDAO extends DAO<ServerUser> {

	readonly discordTokenCookieName = "picgen-bot-discord-token"

	constructor(db: DbConnection, private readonly cookie: CookieController, private readonly discordApi: DiscordApiClient) {
		super(db)
	}

	setDiscordCookieToken(user: ServerUser): void {
		if(!user.discordAccessToken){
			throw new Error("Cannot send discord access token to client: it's empty!")
		}
		this.cookie.set(this.discordTokenCookieName, user.discordAccessToken)
	}

	deleteDiscordCookieToken(): void {
		this.cookie.delete(this.discordTokenCookieName)
	}

	async maybeRenewAccessToken(user: ServerUser): Promise<void> {
		if(!user.discordRefreshToken || !user.discordTokenExpiresAt){
			return
		}
		if(user.discordTokenExpiresAt - timeMarginBeforeRenewal > unixtime()){
			return
		}
		const token = await this.discordApi.getTokenByRefreshToken(user.discordRefreshToken)
		this.setDiscordTokenProps(user, token)
		await this.update(user)
	}

	setDiscordTokenProps(user: ServerUser, token: DiscordApiAccessTokenResponse): void {
		user.discordAccessToken = token.access_token
		user.discordRefreshToken = token.refresh_token
		user.discordTokenExpiresAt = unixtime() + token.expires_in
	}

	makeUser(token: DiscordApiAccessTokenResponse, discordUser: DiscordApiUser): Omit<ServerUser, "id"> {
		return {
			discordAccessToken: token.access_token,
			discordRefreshToken: token.refresh_token,
			discordId: discordUser.id,
			discordTokenExpiresAt: unixtime() + token.expires_in,
			creationTime: unixtime(),
			displayName: discordUser.username
		}
	}

	clearLoginFields(user: ServerUser): void {
		user.discordAccessToken = null
		user.discordRefreshToken = null
		user.discordTokenExpiresAt = null
	}

	async mbGetCurrent(): Promise<ServerUser | undefined> {
		const cookie = this.cookie.get(this.discordTokenCookieName)
		if(!cookie){
			return undefined
		} else {
			return await this.getByFieldValue("discordAccessToken", cookie)
		}
	}

	async getCurrent(): Promise<ServerUser> {
		const user = await this.mbGetCurrent()
		if(!user){
			throw new ApiError("not_logged_in", "User is not logged in")
		}
		return user
	}

	mbGetByDiscordId(discordId: string): Promise<ServerUser | undefined> {
		return this.mbGetByFieldValue("discordId", discordId)
	}

	protected getTableName(): string {
		return "users"
	}

	makeClientUser(user: ServerUser, discordUser: DiscordApiUser): User {
		return {
			avatarUrl: discordUser.avatarUrl,
			displayName: discordUser.username,
			creationTime: user.creationTime,
			id: user.id
		}
	}

}