import * as WebSocket from "ws"
import * as Http from "http"
import {log} from "server/log"
import {errorToErrorApiResp} from "common/infra_entities/api"

type SocketWithData<K, D> = IdWithData<K, D> & {
	socket: WebSocket.WebSocket
}

type IdWithData<K, D> = {
	id: K
	data: D
}

export class WebsocketServer<I, W = void, K extends string | number = string | number, D = void> {

	private readonly server: WebSocket.WebSocketServer

	private readonly userSockets = new Map<K, SocketWithData<K, D>[]>()

	constructor(httpServer: Http.Server,
		authenticator: (req: Http.IncomingMessage) => IdWithData<K, D> | Promise<IdWithData<K, D>>,
		readonly wrapper?: (input: I) => W
	) {
		this.server = new WebSocket.WebSocketServer({
			server: httpServer
		})

		this.server.on("connection", async(conn, req) => {
			conn.on("error", err => {
				log("Websocket errored: " + err)
			})

			let idWithData: IdWithData<K, D>
			try {
				idWithData = await Promise.resolve(authenticator(req))
			} catch(e){
				log("Failed to authenticate websocket connection user: " + e)
				conn.close(undefined, JSON.stringify(errorToErrorApiResp(e)))
				return
			}

			let arr = this.userSockets.get(idWithData.id)
			if(!arr){
				arr = []
				this.userSockets.set(idWithData.id, arr)
			}
			arr.push({...idWithData, socket: conn})

			conn.on("message", () => {
				conn.send(JSON.stringify(errorToErrorApiResp(new Error("Server don't expect anything from clients at websocket channel."))))
			})

			conn.on("close", () => {
				let arr = this.userSockets.get(idWithData.id)
				if(!arr){
					log("Websocket of user " + idWithData + " closed, but it was not stored! That's very unexpected.")
					return
				}

				arr = arr.filter(x => x.socket !== conn)
				if(arr.length === 0){
					this.userSockets.delete(idWithData.id)
				} else {
					this.userSockets.set(idWithData.id, arr)
				}
			})
		})
	}

	private sendIntoConnection(conn: SocketWithData<K, D>, data: I): void {
		const dataStr = JSON.stringify(this.wrapper ? this.wrapper(data) : data)
		conn.socket.send(dataStr)
	}

	sendToAll(data: I): void {
		for(const socketArr of this.userSockets.values()){
			for(const conn of socketArr){
				this.sendIntoConnection(conn, data)
			}
		}
	}

	sendToUser(userKey: K, data: I): void {
		const arr = this.userSockets.get(userKey)
		if(!arr){
			return
		}
		for(const conn of arr){
			this.sendIntoConnection(conn, data)
		}
	}

	sendByCriteria(filter: (conn: IdWithData<K, D>) => boolean, data: I): void {
		for(const conns of this.userSockets.values()){
			for(const conn of conns){
				if(filter(conn)){
					this.sendIntoConnection(conn, data)
				}
			}
		}
	}

	stop(): void {
		for(const connArr of this.userSockets.values()){
			for(const conn of connArr){
				conn.socket.close()
			}
		}
	}

}