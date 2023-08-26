import {httpGet, httpPost} from "server/http/http_req"
import {urlencodeParams} from "server/http/params_urlencode"
import {log} from "server/log"
import * as Http from "http"

export interface DiscordApiUser extends DiscordApiUserCommon {
	avatarUrl: string
}

interface DiscordApiUserRaw extends DiscordApiUserCommon {
	avatar?: string
	// and more https://discord.com/developers/docs/resources/user
}

interface DiscordApiUserCommon {
	id: string
	username: string
	discriminator: string
}

export interface DiscordApiAccessTokenResponse {
	access_token: string
	token_type: "Bearer"
	expires_in: number
	refresh_token: string
	scope: string
}

type DiscordErrorResponse = DiscordValidationErrorResponse | DiscordGeneralErrorResponse

interface DiscordValidationErrorResponse {
	code: number
	errors: Record<string, unknown> // recursive; don't want to type it precisely right now
	message: string
}

interface DiscordGeneralErrorResponse {
	error: string
	error_description: string
}



function isValidationErrorResponse(x: unknown): x is DiscordValidationErrorResponse {
	return !!x && typeof(x) === "object" && !!(x as DiscordValidationErrorResponse).errors
}

function isGeneralErrorResponse(x: unknown): x is DiscordGeneralErrorResponse {
	return !!x && typeof(x) === "object" && typeof((x as DiscordGeneralErrorResponse).error) === "string"
}

export class DiscordApiClient {

	private readonly apiBase = "https://discord.com/api/v10"
	private readonly cdnBase = "https://cdn.discordapp.com"
	private readonly ua = "NartallaxsPictureGeneratorWebgui (http://localhost, 0.0.1)"

	constructor(private readonly clientId: string, private readonly clientSecret: string) {}

	private getParamsBase(): Record<string, string> {
		return {
			client_id: this.clientId,
			client_secret: this.clientSecret
		}
	}

	private async postUrlencodedForJson<T>(url: string, data: Record<string, string>): Promise<T> {
		const body = urlencodeParams(data)
		const resultBytes = await httpPost(this.apiBase + url, Buffer.from(body, "utf-8"), {
			"Content-Type": "application/x-www-form-urlencoded",
			"User-Agent": this.ua
		})
		return this.throwIfError(url, JSON.parse(resultBytes.toString("utf-8")))
	}

	private async getJson<T>(url: string, headers?: Http.OutgoingHttpHeaders): Promise<T> {
		const resultBytes = await httpGet(this.apiBase + url, {
			"Content-Type": "application/json",
			"User-Agent": this.ua,
			...headers
		})
		return this.throwIfError(url, JSON.parse(resultBytes.toString("utf-8")))
	}

	private throwIfError<T>(url: string, value: T | DiscordErrorResponse): T {
		let errMsg: string | null = null
		if(isValidationErrorResponse(value)){
			errMsg = value.message
		} else if(isGeneralErrorResponse(value)){
			errMsg = value.error + ": " + value.error_description
		}

		if(errMsg){
			log(`Full Discord API response for ${url}: ${JSON.stringify(value)}`)
			throw new Error(`Discord API returned error when calling to ${url}: ${errMsg}`)
		}

		return value as T
	}

	getTokenByCode(code: string, redirectUri: string): Promise<DiscordApiAccessTokenResponse> {
		return this.postUrlencodedForJson("/oauth2/token", {
			...this.getParamsBase(),
			grant_type: "authorization_code",
			code: code,
			redirect_uri: redirectUri
		})
	}

	getTokenByRefreshToken(refreshToken: string): Promise<DiscordApiAccessTokenResponse> {
		return this.postUrlencodedForJson("/oauth2/token", {
			...this.getParamsBase(),
			grant_type: "refresh_token",
			refresh_token: refreshToken
		})
	}

	async getCurrentUser(accessToken: string): Promise<DiscordApiUser> {
		const userRaw: DiscordApiUserRaw = await this.getJson("/users/@me", {
			Authorization: `Bearer ${accessToken}`
		})
		let avatarUrl: string
		if(userRaw.avatar){
			avatarUrl = `/avatars/${userRaw.id}/${userRaw.avatar}.png`
		} else {
			const discriminatorDigit = parseInt(userRaw.discriminator) % 5
			avatarUrl = `/embed/avatars/${discriminatorDigit}.png`
		}
		avatarUrl = this.cdnBase + avatarUrl
		return {
			...userRaw,
			avatarUrl
		}
	}

}