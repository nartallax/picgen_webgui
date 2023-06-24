import {log} from "server/log"
import type {ApiNotification, ApiNotificationWrap} from "common/infra_entities/notifications"
import type {ContextController} from "server/context_controller"
import type {DbController} from "server/db/db_controller"
import type {DiscordApiClient} from "server/discord_api_client"
import type {JSONFileListController} from "server/entities/json_file_list"
import type {ServerUser, UserDAO} from "server/entities/user_dao"
import type {HttpServer} from "server/http/http_server"
import type {WebsocketServer} from "server/http/websocket_server"
import type {TaskQueueController} from "server/task_queue_controller"
import type {Context} from "server/context"
import type {Config} from "server/config"
import type {GenerationTaskDAO} from "server/entities/generation_task_dao"
import type {PictureDAO} from "server/entities/picture_dao"

// this file exists for two reasons
// 1. it's convenient to just be able to import a global variable instead of namespace, or get it from another object
// 2. this globals file mostly imports types, which helps a lot with recursive dependencies

export let config: Config = null as any
export let context: ContextController<Context> = null as any
export let dbController: DbController = null as any
export let discordApi: DiscordApiClient = null as any
export let server: HttpServer = null as any
export let websocketServer: WebsocketServer<ApiNotification, ApiNotificationWrap, number, {user: ServerUser}> = null as any
export let taskQueue: TaskQueueController = null as any
export let jsonFileLists: JSONFileListController = null as any

export let generationTaskDao: GenerationTaskDAO = null as any
export let pictureDao: PictureDAO = null as any
export let userDao: UserDAO = null as any

type GlobalService = {
	start?(): unknown | Promise<unknown>
	stop?(): unknown | Promise<unknown>
	readonly name?: string
}
type GlobalServiceRecord<T extends unknown[]> = T extends [infer F, ...(infer R)]
	? [F & GlobalService, ...GlobalServiceRecord<R>]
	: []
/* This object is a pack of all globals there are
This allows it to store them more conveniently and avoid boilerplate sometimes */
type GlobalsPack = GlobalServiceRecord<[
	typeof config,
	typeof context,
	typeof dbController,

	typeof generationTaskDao,
	typeof pictureDao,
	typeof userDao,

	typeof discordApi,
	typeof server,
	typeof websocketServer,
	typeof taskQueue,
	typeof jsonFileLists
]>

let globalsPack: GlobalsPack = null as any

export function setGlobals(globals: GlobalsPack): void {
	globalsPack = globals;

	[
		config,
		context,
		dbController,

		generationTaskDao,
		pictureDao,
		userDao,

		discordApi,
		server,
		websocketServer,
		taskQueue,
		jsonFileLists
	] = globals
}

export async function startGlobals(): Promise<void> {
	for(const service of globalsPack){
		if(service.start){
			// log(`Starting ${service.name ?? service.constructor.name}`)
			await Promise.resolve(service.start())
		}
	}
}

export async function stopGlobals(): Promise<void> {
	for(const service of globalsPack){
		if(service.stop){
			const name = service.name ?? service.constructor.name
			try {
				await Promise.resolve(service.stop())
				log(`${name} stopped.`)
			} catch(e){
				log(`Failed to properly stop ${name}: ${e}`)
			}
		}
	}
	log("Shutdown sequence is completed.")
}