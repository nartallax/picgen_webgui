import {DbConnection, DbController} from "server/db/db_controller"
import {DiscordApiClient} from "server/discord_api_client"
import {GenerationTaskDAO} from "server/entities/generation_task"
import {CompleteUserDAO, UserlessUserDAO} from "server/entities/user"
import {CookieController} from "server/http/cookie_controller"
import * as Http from "http"
import {WebsocketServer} from "server/http/websocket_server"
import {runInAsyncContext} from "server/async_context"
import {Config} from "server/config"
import {TaskQueueController} from "server/task_queue_controller"
import {CompletePictureDAO, UserlessPictureDAO} from "server/entities/picture"

export interface ContextStaticProps {
	config: Config
	discordApi(): DiscordApiClient
	websocketServer(): WebsocketServer
	defaultToHttps: boolean
	db(): DbController
	taskQueue(): TaskQueueController
}

export class UserlessContext {
	readonly user: UserlessUserDAO = new UserlessUserDAO(() => this)
	readonly generationTask = new GenerationTaskDAO(() => this)
	readonly picture: UserlessPictureDAO = new UserlessPictureDAO(() => this)

	private closeWaiters = null as null | (() => void)[]

	redirectUrl: string | null = null

	constructor(
		readonly discordApi: DiscordApiClient,
		readonly db: DbConnection,
		readonly websockets: WebsocketServer,
		readonly config: Config,
		readonly dbController: DbController,
		readonly taskQueue: TaskQueueController
	) {}

	onClosed(handler: () => void): void {
		(this.closeWaiters ||= []).push(handler)
	}

	waitClosed(): Promise<void> {
		return new Promise(ok => this.onClosed(ok))
	}

	notifyClosed(): void {
		if(this.closeWaiters){
			for(const waiter of this.closeWaiters){
				waiter()
			}
		}
	}
}

export type UserlessContextFactory = <T>(runner: (context: UserlessContext) => T | Promise<T>) => Promise<T>
export type RequestContextFactory = <T>(req: Http.IncomingMessage, runner: (context: RequestContext) => T | Promise<T>) => Promise<T>

export class RequestContext extends UserlessContext {
	readonly user: CompleteUserDAO = new CompleteUserDAO(() => this)
	readonly picture: CompletePictureDAO = new CompletePictureDAO(() => this)

	redirectUrl: string | null = null

	constructor(
		readonly requestUrl: URL,
		readonly cookie: CookieController,
		discordApi: DiscordApiClient,
		db: DbConnection,
		websockets: WebsocketServer,
		config: Config,
		dbController: DbController,
		taskQueue: TaskQueueController
	) {
		super(discordApi, db, websockets, config, dbController, taskQueue)
	}

	static makeUserlessFactory(baseProps: ContextStaticProps): UserlessContextFactory {
		return async runner => {
			return await baseProps.db().inTransaction(conn => {
				const context = new UserlessContext(
					baseProps.discordApi(),
					conn,
					baseProps.websocketServer(),
					baseProps.config,
					baseProps.db(),
					baseProps.taskQueue()
				)

				return runner(context)
			})
		}
	}

	static makeFactory(baseProps: ContextStaticProps): RequestContextFactory {
		return async(req, runner) => {
			const urlStr = req.url || "/"
			const hostHeader = req.headers.host
			if(!hostHeader){
				throw new Error("Host header is not present.")
			}
			const url = new URL(urlStr, (baseProps.defaultToHttps ? "https" : "http") + "://" + hostHeader)

			return await baseProps.db().inTransaction(async conn => {
				const context = new RequestContext(
					url,
					new CookieController(req),
					baseProps.discordApi(),
					conn,
					baseProps.websocketServer(),
					baseProps.config,
					baseProps.db(),
					baseProps.taskQueue()
				)

				try {
					return await runInAsyncContext(context, () => runner(context))
				} finally {
					context.notifyClosed()
				}
			})
		}
	}

}

