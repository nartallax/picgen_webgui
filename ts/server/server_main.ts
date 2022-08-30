import {getCliArgs} from "server/cli_args"
import {HttpServer} from "server/http_server"
import {errToString} from "server/utils/err_to_string"

export async function main() {
	try {
		await mainInternal()
	} catch(e){
		console.error("Failed to start: " + errToString(e))
		process.exit(1)
	}
}

function cloneShit(shit: string, times: number): string {
	return new Array(times + 1).join(shit)
}

async function mainInternal(): Promise<void> {
	const cliArgs = getCliArgs()
	const server = new HttpServer({
		port: cliArgs.port,
		httpRoot: cliArgs.httpRootDir,
		apiRoot: "/api/",
		inputSizeLimit: 1024 * 1024 * 16,
		readTimeoutSeconds: 3 * 60,
		cacheDuration: 0,
		apiMethods: {
			cloneShit
		}
	})

	const port = await server.start()
	console.error("Server started at http://localhost:" + port + "/")
}