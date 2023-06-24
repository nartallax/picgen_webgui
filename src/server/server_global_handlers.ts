import {log} from "server/log"
import {stopGlobals} from "server/server_globals"
import {errToString} from "server/utils/err_to_string"

export function setupGlobalServerHandlers(): void {
	process.on("uncaughtException", err => {
		log("Uncaught exception! " + err.stack)
	})

	process.on("unhandledRejection", err => {
		log("Uncaught exception! " + errToString(err))
	})

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

		await stopGlobals()
	})
}