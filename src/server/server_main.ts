import {closeAsyncContext, initAsyncContext} from "server/async_context"
import {config, loadConfig} from "server/config"
import {DbController} from "server/db/db_controller"
import {DiscordApiClient} from "server/discord_api_client"
import {HttpServer} from "server/http/http_server"
import {WebsocketServer} from "server/http/websocket_server"
import {log} from "server/log"
import {migrations} from "server/migrations"
import {TaskQueueController} from "server/task_queue_controller"
import {ContextStaticProps, RequestContext} from "server/request_context"
import {ServerApi} from "server/server_api"
import {errToString} from "server/utils/err_to_string"
import {ApiNotification, ApiNotificationWrap} from "common/infra_entities/notifications"
import {ServerUser} from "server/entities/user"
import {JSONFileListController} from "server/entities/json_file_list"

export async function main() {
	try {
		await mainInternal()
	} catch(e){
		console.error("Failed to start: " + errToString(e))
		process.exit(1)
	}
}

async function mainInternal(): Promise<void> {
	await loadConfig()

	const contextStaticProps: ContextStaticProps = {
		config,
		db: () => db,
		discordApi: () => discordApi,
		defaultToHttps: config.haveHttps,
		websocketServer: () => websocketServer,
		taskQueue: () => taskQueue,
		jsonFileList: () => jsonFileLists
	}

	process.on("uncaughtException", err => {
		log("Uncaught exception! " + err.stack)
	})

	process.on("unhandledRejection", err => {
		log("Uncaught exception! " + errToString(err))
	})

	const contextFactory = RequestContext.makeFactory(contextStaticProps)
	const userlessContextFactory = RequestContext.makeUserlessFactory(contextStaticProps)

	const db = new DbController(config.dbFilePath, migrations)
	await db.init()

	const discordApi = new DiscordApiClient(config.discordClientId, config.discordClientSecret)

	const server = new HttpServer({
		port: config.httpPort,
		host: config.httpHost,
		httpRoot: config.httpRootDir,
		apiRoot: "/api/",
		inputSizeLimit: 1024 * 1024 * 16,
		readTimeoutSeconds: 3 * 60,
		apiMethods: ServerApi as any, // ffs
		contextFactory,
		httpRootUrl: config.httpRootUrl ? config.httpRootUrl : undefined // don't pass empty str
	})

	const websocketServer = new WebsocketServer<ApiNotification, ApiNotificationWrap, number, {user: ServerUser}>(server.server, req => contextFactory(req, async context => {
		const user = await context.user.getCurrent()
		return {id: user.id, data: {user}}
	}), notification => ({notification}))

	const taskQueue = new TaskQueueController(userlessContextFactory)

	const jsonFileLists = new JSONFileListController(userlessContextFactory)

	initAsyncContext("picgen-gui")

	await taskQueue.init()
	await jsonFileLists.start()
	const port = await server.start()
	log(`Server started at ${config.haveHttps ? "https" : "http"}://${config.httpHost || "localhost"}:${port}/`)

	let shutdownRequested = 0
	process.on("SIGINT", async() => {
		switch(shutdownRequested){
			case 0:
				shutdownRequested++
				break
			case 1:
				// wtfnode.dump()
				log("Stop was already requested. If you want to force-terminate the app - request it one more time")
				shutdownRequested++
				return
			case 2:
				log("Force termination was requested.")
				process.exit(1)
		}
		log("Stop is requested by interrupt signal.")

		try {
			await Promise.resolve(websocketServer.stop())
			log("Websocket server stopped.")
		} catch(e){
			log("Failed to properly stop websocket server: " + e)
		}

		try {
			await server.stop()
			log("Webserver stopped.")
		} catch(e){
			log("Failed to properly stop webserver: " + e)
		}

		try {
			await db.waitAllConnectionsClosed()
			log("All DB connections are closed.")
		} catch(e){
			log("Failed to properly close connection to DB: " + e)
		}

		try {
			closeAsyncContext()
			log("Async contexts are closed.")
		} catch(e){
			log("Failed to properly close async contexts: " + e)
		}

		try {
			log("Shutting down task queue...")
			await taskQueue.stop()
			log("Task queue is shut down.")
		} catch(e){
			log("Failed to properly shut down task queue: " + e)
		}

		try {
			await Promise.resolve(jsonFileLists.stop())
			log("JSON file list watcher stopped.")
		} catch(e){
			log("Failed to properly stop JSON file list watcher: " + e)
		}

		log("Shutdown sequence is completed.")
	})
}

main()