import type {DbConnection, DbController} from "server/db/db_controller"
import type {DiscordApiClient} from "server/discord_api_client"
import {GenerationTaskDAO} from "server/entities/generation_task"
import {CompleteUserDAO, ServerUser, UserlessUserDAO} from "server/entities/user"
import {CookieController} from "server/http/cookie_controller"
import * as Http from "http"
import type {WebsocketServer} from "server/http/websocket_server"
import {runInAsyncContext} from "server/async_context"
import type {Config} from "server/config"
import type {TaskQueueController} from "server/task_queue_controller"
import {CompletePictureDAO, UserlessPictureDAO} from "server/entities/picture"
import {logError} from "server/log"
import type {ApiNotification, ApiNotificationWrap} from "common/infra_entities/notifications"
import type {JSONFileListController} from "server/entities/json_file_list"

export interface ContextStaticProps {
	config: Config
	discordApi(): DiscordApiClient
	websocketServer(): WSServer
	defaultToHttps: boolean
	db(): DbController
	taskQueue(): TaskQueueController
	jsonFileList(): JSONFileListController
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
		readonly websockets: WSServer,
		readonly config: Config,
		readonly dbController: DbController,
		readonly taskQueue: TaskQueueController,
		readonly jsonFileList: JSONFileListController
	) {}

	onClosed(handler: () => void): void {
		(this.closeWaiters ||= []).push(handler)
	}

	waitClosed(): Promise<void> {
		return new Promise(ok => this.onClosed(ok))
	}

	private async runCloseWaiter(waiter: () => void) {
		try {
			await Promise.resolve(waiter())
		} catch(e){
			logError(e)
		}
	}

	notifyClosed(): void {
		if(this.closeWaiters){
			for(const waiter of this.closeWaiters){
				this.runCloseWaiter(waiter)
			}
		}
	}
}

export type UserlessContextFactory = <T>(runner: (context: UserlessContext) => T | Promise<T>) => Promise<T>
export type RequestContextFactory = <T>(req: Http.IncomingMessage, runner: (context: RequestContext) => T | Promise<T>) => Promise<T>
type WSServer = WebsocketServer<ApiNotification, ApiNotificationWrap, number, {user: ServerUser}>

export class RequestContext extends UserlessContext {
	readonly user: CompleteUserDAO = new CompleteUserDAO(() => this)
	readonly picture: CompletePictureDAO = new CompletePictureDAO(() => this)

	redirectUrl: string | null = null

	constructor(
		readonly requestUrl: URL,
		readonly cookie: CookieController,
		readonly responseHeaders: Http.OutgoingHttpHeaders,
		discordApi: DiscordApiClient,
		db: DbConnection,
		websockets: WSServer,
		config: Config,
		dbController: DbController,
		taskQueue: TaskQueueController,
		jsonFileList: JSONFileListController
	) {
		super(discordApi, db, websockets, config, dbController, taskQueue, jsonFileList)
	}

	static makeUserlessFactory(baseProps: ContextStaticProps): UserlessContextFactory {
		return runner => this.runWithContextCreator(baseProps.db(), conn => new UserlessContext(
			baseProps.discordApi(),
			conn,
			baseProps.websocketServer(),
			baseProps.config,
			baseProps.db(),
			baseProps.taskQueue(),
			baseProps.jsonFileList()
		), runner)
	}

	static makeFactory(baseProps: ContextStaticProps): RequestContextFactory {
		return async(req, runner) => {
			const urlStr = req.url || "/"
			const hostHeader = req.headers.host
			if(!hostHeader){
				throw new Error("Host header is not present.")
			}
			const url = new URL(urlStr, (baseProps.defaultToHttps ? "https" : "http") + "://" + hostHeader)

			return this.runWithContextCreator(baseProps.db(), conn => new RequestContext(
				url,
				new CookieController(req),
				{},
				baseProps.discordApi(),
				conn,
				baseProps.websocketServer(),
				baseProps.config,
				baseProps.db(),
				baseProps.taskQueue(),
				baseProps.jsonFileList()
			), runner)
		}
	}

	private static async runWithContextCreator<T extends UserlessContext, R>(db: DbController, creator: (conn: DbConnection) => T, runner: (context: T) => R | Promise<R>): Promise<R> {
		const {context, result, error} = await db.inTransaction(async conn => {
			const context = creator(conn)

			try {
				const result = await runInAsyncContext(context, () => runner(context))
				return {context, result, error: null}
			} catch(e){
				return {context, result: null, error: e}
			}
		})

		context.notifyClosed()

		if(error){
			throw error
		} else {
			return result!
		}
	}

}

