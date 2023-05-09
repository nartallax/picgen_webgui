import * as Http from "http"
import * as Https from "https"
import {readStreamToBuffer} from "server/utils/read_stream_to_buffer"

export function httpGet(urlStr: string | URL, headers?: Http.OutgoingHttpHeaders): Promise<Buffer> {
	return new Promise((ok, bad) => {
		const url = urlStr instanceof URL ? urlStr : new URL(urlStr)
		const lib = url.protocol.toLowerCase() === "https:" ? Https : Http
		const request = lib.request({
			method: "GET",
			host: url.hostname,
			port: url.port,
			path: url.pathname + (url.search || ""),
			headers
		}, async response => {
			response.on("error", e => bad(e))
			try {
				ok(await readStreamToBuffer(response, 1024 * 1024 * 1024, 3 * 60 * 1000))
			} catch(e){
				bad(e)
			}
		})
		request.on("error", e => bad(e))
		request.end()
	})
}

export function httpPost(urlStr: string, body: Buffer, headers?: Http.OutgoingHttpHeaders): Promise<Buffer> {
	return new Promise((ok, bad) => {
		const url = new URL(urlStr)
		const lib = url.protocol.toLowerCase() === "https:" ? Https : Http
		const request = lib.request({
			method: "POST",
			host: url.host,
			port: url.port,
			path: url.pathname + (url.search || ""),
			headers: headers
		}, async response => {
			try {
				ok(await readStreamToBuffer(response, 1024 * 1024 * 1024, 3 * 60 * 1000))
			} catch(e){
				bad(e)
			}

		})
		request.on("error", e => bad(e))
		request.end(body)
	})
}