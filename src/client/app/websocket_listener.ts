import {WBox} from "@nartallax/cardboard"
import {allKnownLoras} from "client/app/global_values"
import {Event} from "client/base/event"
import {showToast} from "client/controls/toast/toast"
import {GenerationTask, GenerationTaskWithPictures} from "common/entities/generation_task"
import {ApiNotification} from "common/infra_entities/notifications"

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
						this.start()
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
				this.tasks([
					{...notification.task, pictures: []},
					...this.tasks()
				])
				break
			case "task_started":
				this.updateTaskById(
					notification.taskId,
					task => ({...task, status: "running", startTime: notification.startTime})
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
					task => ({...task, status: "completed", finishTime: notification.finishTime})
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
			case "task_prompt_updated":
				this.updateTaskById(
					notification.taskId,
					task => ({...task, prompt: notification.prompt})
				)
				break
			case "task_admin_notification":
				onAdminTaskUpdate.fire(notification.task)
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
			case "lora_description_update":
				allKnownLoras(notification.newLoraDescriptions)
				break
			default:
				console.log("Unrecognised websocket notification", notification)
				break
		}
	}

	private updateTaskById(taskId: number, updater: (task: GenerationTaskWithPictures) => GenerationTaskWithPictures): void {
		let tasks = this.tasks()
		for(let i = 0; i < tasks.length; i++){
			const task = tasks[i]!
			if(task.id === taskId){
				tasks = [...tasks]
				tasks[i] = updater(task)
				this.tasks(tasks)
				return
			}
		}
	}
}