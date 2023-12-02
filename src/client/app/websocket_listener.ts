import {WBox} from "@nartallax/cardboard"
import {allKnownJsonFileLists, queueStatus} from "client/app/global_values"
import {Event} from "client/base/event"
import {editableTextBlurLock} from "client/components/editable_text_block/editable_text_block"
import {showToast} from "client/controls/toast/toast"
import {GenerationTask, GenerationTaskWithPictures} from "common/entities/generation_task"
import {ApiNotification} from "common/infra_entities/notifications"
import {sortBy} from "common/utils/sort_by"

export const onAdminTaskUpdate = new Event<GenerationTask>()

export class WebsocketListener {
	private socket: WebSocket | null = null
	private shouldBeWorking = false

	constructor(private readonly tasks: WBox<GenerationTaskWithPictures[]>) {}

	start(): Promise<void> {
		this.shouldBeWorking = true
		return new Promise(ok => {
			const protocol = window.location.protocol.toLowerCase().startsWith("https") ? "wss" : "ws"
			const wsUrl = `${protocol}://${window.location.host}`
			this.socket = new WebSocket(wsUrl)
			this.socket.onmessage = evt => {
				if(typeof(evt.data) === "string"){
					// console.log("Websocket event: " + evt.data)
					this.applyNotification(JSON.parse(evt.data).notification)
				} else {
					console.error("Typeof of websocket event data is not string, don't know what to do: ", evt.data)
				}
			}
			this.socket.onopen = () => {
				console.log("Websocket connected.")
				ok()
			}
			this.socket.onclose = () => {
				console.log("Websocket disconnected.")
				this.socket = null
				setTimeout(() => {
					if(this.shouldBeWorking && !this.socket){
						void this.start()
					}
				}, 15000)
			}
		})
	}

	stop(): void {
		this.shouldBeWorking = false
		if(this.socket){
			this.socket.close()
			this.socket = null
		}
	}

	private applyNotification(notification: ApiNotification): void {
		switch(notification.type){
			case "task_created":
				this.tasks.prependElement({...notification.task, pictures: []})
				break
			case "task_warming_up":
				this.updateTaskById(
					notification.taskId,
					task => ({...task, status: "warmingUp"})
				)
				break
			case "task_expected_picture_count_known":
				this.updateTaskById(
					notification.taskId,
					task => ({...task, expectedPictures: notification.expectedPictureCount})
				)
				break
			case "task_finished":
				this.updateTaskById(
					notification.taskId,
					task => ({
						...task,
						status: "completed",
						finishTime: notification.finishTime,
						exitCode: notification.exitCode
					})
				)
				break
			case "task_generated_picture":
				this.updateTaskById(
					notification.taskId,
					task => ({
						...task,
						pictures: [...task.pictures, notification.picture],
						generatedPictures: notification.generatedPictures
					})
				)
				break
			case "task_arguments_updated":
				this.updateTaskById(
					notification.taskId,
					task => ({
						...task,
						arguments: {
							...task.arguments,
							...notification.args
						}
					})
				)
				break
			case "task_admin_notification":
				onAdminTaskUpdate.fire(notification.task)
				break
			case "task_warmup_finished":
				this.updateTaskById(
					notification.taskId,
					task => ({
						...task,
						status: "running",
						startTime: notification.startTime
					})
				)
				break
			case "task_message":
				showToast({
					type: notification.messageType,
					timeoutSeconds: notification.displayFor ?? 15,
					text: notification.message
				})
				break
			case "task_estimated_duration_known":
				this.updateTaskById(
					notification.taskId,
					task => ({...task, estimatedDuration: notification.estimatedDuration})
				)
				break
			case "json_file_list_update": {
				const newMap = {...allKnownJsonFileLists.get()}
				newMap[notification.directory] = notification.items
				allKnownJsonFileLists.set(newMap)
				break
			}
			case "queue_status_change": {
				queueStatus.set(notification.newStatus)
				break
			}
			case "task_edit_locked": {
				this.updateTaskById(
					notification.taskId,
					task => ({...task, status: "lockedForEdit"}))
				break
			}
			case "task_reordering": {
				editableTextBlurLock.set(true)
				try {
					let tasks = this.tasks.get()
					const idToRunOrderMap = new Map(notification.orderPairs.map(({id, runOrder}) => [id, runOrder]))
					for(let i = 0; i < tasks.length; i++){
						let task = tasks[i]!
						const newRunOrder = idToRunOrderMap.get(task.id)
						if(newRunOrder !== undefined){
							task = {...task, runOrder: newRunOrder}
							tasks[i] = task
						}
					}
					tasks = sortBy(tasks, task => -task.runOrder)
					this.tasks.set(tasks)
				} finally {
					editableTextBlurLock.set(false)
				}
				break
			}
			case "task_edit_unlocked": {
				this.updateTaskById(
					notification.taskId,
					task => {
						if(task.status === "lockedForEdit"){
							return ({...task, status: "queued"})
						} else {
							// I'm afraid that there may be two concurrent notifications,
							// about task unlock and task start
							// and if task is started - we should'nt put it back into queued state
							return task
						}
					})
				break
			}
			default:
				console.log("Unrecognised websocket notification", notification)
				break
		}
	}

	private updateTaskById(taskId: number, updater: (task: GenerationTaskWithPictures) => GenerationTaskWithPictures): void {
		let tasks = this.tasks.get()
		for(let i = 0; i < tasks.length; i++){
			const task = tasks[i]!
			if(task.id === taskId){
				tasks = [...tasks]
				tasks[i] = updater(task)
				this.tasks.setElementAtIndex(i, updater(task))
				return
			}
		}
	}
}