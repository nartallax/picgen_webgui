import {loadConfig} from "server/config"
import {DbController} from "server/db/db_controller"
import {DiscordApiClient} from "server/discord_api_client"
import {HttpServer, apiMethodArgsToString} from "server/http/http_server"
import {WebsocketServer} from "server/http/websocket_server"
import {log} from "server/log"
import {migrations} from "server/migrations"
import {TaskQueueController} from "server/task_queue_controller"
import {ServerApi} from "server/server_api"
import {errToString} from "server/utils/err_to_string"
import {ApiNotification, ApiNotificationWrap} from "common/infra_entities/notifications"
import {ServerUser, UserDAO} from "server/entities/user_dao"
import {JSONFileListController} from "server/entities/json_file_list"
import {setGlobals, startGlobals, userDao} from "server/server_globals"
import {ContextController} from "server/context_controller"
import {setupGlobalServerHandlers} from "server/server_global_handlers"
import {Context, runWithHttpRequestContext} from "server/context"
import {GenerationTaskDAO} from "server/entities/generation_task_dao"
import {PictureDAO} from "server/entities/picture_dao"
import {ThumbnailController} from "server/thumbnail_controller"
import {UserStaticController} from "server/user_static_controller"
import {TaskEditLockController} from "server/task_edit_lock_controller"

export async function main() {
	try {
		await mainInternal()
	} catch(e){
		console.error("Failed to start: " + errToString(e))
		process.exit(1)
	}
}

async function mainInternal(): Promise<void> {
	setupGlobalServerHandlers()

	const config = await loadConfig()

	const context = new ContextController<Context>("picgen_webgui_contexts")

	const server = new HttpServer({
		port: config.httpPort,
		host: config.httpHost,
		httpRoot: config.httpRootDir,
		apiRoot: "/api/",
		inputSizeLimit: 1024 * 1024 * 16,
		readTimeoutSeconds: 3 * 60,
		apiMethods: ServerApi as any, // ffs
		runRequestHandler: (req, runner, method, args) => runWithHttpRequestContext(req, async ctx => {
			// if it goes through GET - it's not very important probably, no need to log
			if((req.method ?? "GET").toUpperCase() !== "GET"){
				const user = await userDao.queryCurrent()
				const userStr = !user ? "<anon>" : user.displayName
				log(`${userStr}: ${method}(${apiMethodArgsToString(args)})`)
			}
			return {
				body: await runner(),
				headers: ctx.responseHeaders,
				redirectUrl: ctx.redirectUrl ?? undefined,
				cookie: ctx.cookie.harvestSetCookieLines()
			}
		}),
		httpRootUrl: config.httpRootUrl ? config.httpRootUrl : undefined // don't pass empty str
	})

	setGlobals([
		config,
		context,
		new DbController(config.dbFilePath, migrations),

		new GenerationTaskDAO(),
		new PictureDAO(),
		new UserDAO(),

		new DiscordApiClient(config.discordClientId, config.discordClientSecret),
		server,
		new WebsocketServer<ApiNotification, ApiNotificationWrap, number, {user: ServerUser}>(server.server, req =>
			runWithHttpRequestContext(req, async() => {
				const user = await userDao.getCurrent()
				return {id: user.id, data: {user}}
			}), notification => ({notification})),
		new TaskEditLockController(),
		new TaskQueueController(),
		new JSONFileListController(),
		new ThumbnailController(config.thumbnails),
		new UserStaticController(config.userStatic)
	])

	await startGlobals()

	log(`Server started at ${config.haveHttps ? "https" : "http"}://${config.httpHost || "localhost"}:${config.httpPort}/`)
}

void main()