import {Runtyper} from "@nartallax/runtyper"
import {closeAsyncContext, initAsyncContext} from "server/async_context"
import {config, loadConfig} from "server/config"
import {DbController} from "server/db_controller"
import {DiscordApiClient} from "server/discord_api_client"
import {HttpServer} from "server/http/http_server"
import {WebsocketServer} from "server/http/websocket_server"
import {log} from "server/log"
import {migrations} from "server/migrations"
import {RequestContext} from "server/request_context"
import {ServerApi} from "server/server_api"
import {errToString} from "server/utils/err_to_string"

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

	const db = new DbController(config.dbFilePath, migrations)
	await db.init()

	const contextFactory = RequestContext.makeFactory({
		db: () => db,
		discordApi: () => discordApi,
		defaultToHttps: config.defaultToHttps,
		websocketServer: () => websocketServer
	})

	const discordApi = new DiscordApiClient(config.discordClientId, config.discordClientSecret)

	const server = new HttpServer({
		port: config.port,
		httpRoot: config.httpRootDir,
		apiRoot: "/api/",
		inputSizeLimit: 1024 * 1024 * 16,
		readTimeoutSeconds: 3 * 60,
		cacheDuration: 0,
		apiMethods: ServerApi,
		contextFactory
	})

	const websocketServer = new WebsocketServer(server.server, req => contextFactory(req, async context => {
		const user = await context.user.getCurrent()
		return user.id
	}))

	initAsyncContext("picgen-gui")

	Runtyper.cleanup()

	const port = await server.start()
	log("Server started at http://localhost:" + port + "/")

	process.on("SIGINT", async() => {
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

		log("Shutdown sequence is completed.")
	})
}