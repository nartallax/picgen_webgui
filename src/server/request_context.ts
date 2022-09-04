import {DbConnection} from "server/db_controller"
import {DiscordApiClient} from "server/discord_api_client"
import {GenerationTaskDAO} from "server/entities/generation_task"
import {PictureDAO} from "server/entities/picture"
import {UserDAO} from "server/entities/user"
import {CookieController} from "server/http/cookie_controller"

export class RequestContext {
	readonly user = new UserDAO(this.db, this.cookie, this.discordApi)
	readonly generationTask = new GenerationTaskDAO(this.db)
	readonly picture = new PictureDAO(this.db)

	redirectUrl: string | null = null

	constructor(
		readonly requestUrl: URL,
		readonly cookie: CookieController,
		readonly discordApi: DiscordApiClient,
		private readonly db: DbConnection
	) {}

}