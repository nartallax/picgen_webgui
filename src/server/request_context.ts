import {DbConnection, DbController} from "server/db_controller"
import {DiscordApiClient} from "server/discord_api_client"
import {GenerationTaskDAO} from "server/entities/generation_task"
import {PictureDAO} from "server/entities/picture"
import {UserDAO} from "server/entities/user"
import {CookieController} from "server/http/cookie_controller"
import * as Http from "http"
import {WebsocketServer} from "server/http/websocket_server"
import {runInAsyncContext} from "server/async_context"

interface RequestContextStaticProps {
	discordApi(): DiscordApiClient
	websocketServer(): WebsocketServer
	defaultToHttps: boolean
	db(): DbController
}

export type RequestContextFactory = <T>(req: Http.IncomingMessage, runner: (context: RequestContext) => T | Promise<T>) => Promise<T>

export class RequestContext {
	readonly user = new UserDAO(this.db, this.cookie, this.discordApi)
	readonly generationTask = new GenerationTaskDAO(this.db)
	readonly picture = new PictureDAO(this.db)

	redirectUrl: string | null = null

	constructor(
		readonly requestUrl: URL,
		readonly cookie: CookieController,
		readonly discordApi: DiscordApiClient,
		private readonly db: DbConnection,
		readonly websockets: WebsocketServer
	) {}

	static makeFactory(baseProps: RequestContextStaticProps): RequestContextFactory {
		return async(req, runner) => {
			const urlStr = req.url || "/"
			const hostHeader = req.headers.host
			if(!hostHeader){
				throw new Error("Host header is not present.")
			}
			const url = new URL(urlStr, (baseProps.defaultToHttps ? "https" : "http") + "://" + hostHeader)

			return await baseProps.db().inTransaction(conn => {
				const context = new RequestContext(
					url,
					new CookieController(req),
					baseProps.discordApi(),
					conn,
					baseProps.websocketServer()
				)

				return runInAsyncContext(context, () => runner(context))
			})
		}
	}

}

