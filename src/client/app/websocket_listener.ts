import {WBox} from "client/base/box"
import {GenerationTask} from "common/entity_types"

export class WebsocketListener {
	private socket: WebSocket | null = null
	private shouldBeWorking = false

	constructor(private readonly tasks: WBox<GenerationTask[]>) {}

	start(): Promise<void> {
		this.shouldBeWorking = true
		return new Promise(ok => {
			const protocol = window.location.protocol.toLowerCase().startsWith("https") ? "wss" : "ws"
			const wsUrl = `${protocol}://${window.location.host}`
			this.socket = new WebSocket(wsUrl)
			this.socket.onmessage = evt => {
				console.log(typeof(evt.data), evt.data)
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

			void this.tasks
		})
	}

	stop(): void {
		this.shouldBeWorking = false
		if(this.socket){
			this.socket.close()
			this.socket = null
		}
	}
}