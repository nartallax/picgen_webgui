import * as WebSocket from "ws"
import * as Http from "http"
import {log} from "server/log"
import {errorToErrorApiResp} from "common/api_error"
import {ApiNotification, ApiNotificationWrap} from "common/common_types"

export class WebsocketServer<K extends string | number = string | number> {

	private readonly server: WebSocket.WebSocketServer

	private readonly userSockets = new Map<K, WebSocket.WebSocket[]>()

	constructor(httpServer: Http.Server, authenticator: (req: Http.IncomingMessage) => K | Promise<K>) {
		this.server = new WebSocket.WebSocketServer({
			server: httpServer
		})

		this.server.on("connection", async(conn, req) => {
			conn.on("error", err => {
				log("Websocket errored: " + err)
			})

			let userKey: K
			try {
				userKey = await Promise.resolve(authenticator(req))
			} catch(e){
				log("Failed to authenticate websocket connection user: " + e)
				conn.close(undefined, JSON.stringify(errorToErrorApiResp(e)))
				return
			}

			let arr = this.userSockets.get(userKey)
			if(!arr){
				arr = []
				this.userSockets.set(userKey, arr)
			}
			arr.push(conn)

			conn.on("message", () => {
				conn.send(JSON.stringify(errorToErrorApiResp(new Error("Server don't expect anything from clients at websocket channel."))))
			})

			conn.on("close", () => {
				let arr = this.userSockets.get(userKey)
				if(!arr){
					log("Websocket of user " + userKey + " closed, but it was not stored! That's very unexpected.")
					return
				}

				arr = arr.filter(x => x !== conn)
				if(arr.length === 0){
					this.userSockets.delete(userKey)
				} else {
					this.userSockets.set(userKey, arr)
				}
			})
		})
	}

	sendNotificationToAll(data: ApiNotification): void {
		const wrapped: ApiNotificationWrap = {notification: data}
		const dataStr = JSON.stringify(wrapped)
		for(const socketArr of this.userSockets.values()){
			for(const conn of socketArr){
				conn.send(dataStr)
			}
		}
	}

	sendNotificationToUser(userKey: K, data: ApiNotification): void {
		const arr = this.userSockets.get(userKey)
		if(!arr){
			return
		}
		const wrapped: ApiNotificationWrap = {notification: data}
		const dataStr = JSON.stringify(wrapped)
		for(const conn of arr){
			conn.send(dataStr)
		}
	}

	stop(): void {
		for(const connArr of this.userSockets.values()){
			for(const conn of connArr){
				conn.close()
			}
		}
	}

}