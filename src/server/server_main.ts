import {Runtyper} from "@nartallax/runtyper"
import {config, loadConfig} from "server/config"
import {HttpServer} from "server/http_server"
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

	const server = new HttpServer({
		port: config.port,
		httpRoot: config.httpRootDir,
		apiRoot: "/api/",
		inputSizeLimit: 1024 * 1024 * 16,
		readTimeoutSeconds: 3 * 60,
		cacheDuration: 0,
		apiMethods: ServerApi
	})

	Runtyper.cleanup()

	const port = await server.start()
	console.error("Server started at http://localhost:" + port + "/")
}