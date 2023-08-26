import * as Http from "http"
import * as Path from "path"
import * as Fs from "fs"
import * as MimeTypes from "mime-types"
import {isPathInsidePath} from "server/utils/is_path_inside_path"
import {isEnoent} from "server/utils/is_enoent"
import {errToString} from "server/utils/err_to_string"
import {readStreamToBuffer} from "server/utils/read_stream_to_buffer"
import {ApiError} from "common/infra_entities/api_error"
import {log} from "server/log"
import {RCV} from "@nartallax/ribcage-validation"
import {httpGet} from "server/http/http_req"
import {ApiResponse, errorToErrorApiResp} from "common/infra_entities/api"

interface HttpServerOptions {
	readonly port: number
	readonly host?: string
	readonly httpRoot: string
	readonly apiRoot: string
	readonly inputSizeLimit: number
	readonly readTimeoutSeconds: number
	readonly apiMethods: {
		readonly [name: string]: (args: Record<string, unknown>) => (unknown | Promise<unknown>)
	}
	readonly httpRootUrl?: string
	readonly runRequestHandler: <T>(req: Http.IncomingMessage, runner: () => T | Promise<T>, methodName: string, methodArgs: Record<string, unknown>) => Promise<RequestRunResult<T>>
}

interface RequestRunResult<T> {
	body?: T
	cookie?: string[]
	headers?: Http.OutgoingHttpHeaders
	redirectUrl?: string
}

if(Math.random() > 1){
	// this helps with weird parcel bug about http
	console.log(Http)
}

export class HttpServer {
	readonly name = "HTTP server"

	readonly server: Http.Server

	constructor(private readonly opts: HttpServerOptions) {
		this.server = new Http.Server((req, res) => this.processRequest(req, res))
	}

	start(): Promise<number> {
		return new Promise((ok, bad) => {
			this.server.listen(this.opts.port, this.opts.host, () => {
				const addr = this.server.address()
				if(!addr || typeof(addr) !== "object"){
					bad(new Error("Server address is not an object: " + addr))
					return
				}
				ok(addr.port)
			})
		})
	}

	stop(): Promise<void> {
		return new Promise((ok, bad) => this.server.close(err => err ? bad(err) : ok()))
	}

	private async processRequest(req: Http.IncomingMessage, res: Http.ServerResponse): Promise<void> {
		try {
			req.on("error", err => console.error("Error on HTTP request: " + errToString(err)))
			res.on("error", err => console.error("Error on HTTP response: " + errToString(err)))

			const method = (req.method || "").toUpperCase()
			if(!method){
				return await endRequest(res, 400, "Where Is The Method Name You Fucker")
			}

			const urlStr = req.url || "/"
			const hostHeader = req.headers.host
			if(!hostHeader){
				return await endRequest(res, 400, "Where Is Host Header I Require It To Be Present")
			}
			const url = new URL(urlStr, "http://localhost")
			const path = url.pathname

			if(path.startsWith(this.opts.apiRoot)){
				if(method !== "GET" && method !== "POST" && method !== "PUT"){
					await endRequest(res, 405, "Your HTTP Method Name Sucks")
				}
				await this.processApiRequest(url, req, res)
			} else {
				switch(method){
					case "GET":
						if(this.opts.httpRootUrl){
							await this.processStaticRequestByProxy(path, this.opts.httpRootUrl, res)
						} else {
							await this.processStaticRequestByFile(path, res)
						}
						return
					default:
						await endRequest(res, 400, "What The Fuck Do You Want From Me")
						return
				}
			}
		} catch(e){
			console.error(errToString(e))
			await endRequest(res, 500, "We Fucked Up", "UwU")
		}
	}

	private addStaticHeaders(path: string, res: Http.ServerResponse, preventCache: boolean): void {
		if(path.toLowerCase().endsWith(".html") || preventCache){
			// never store the html
			res.setHeader("Cache-Control", "max-age=0, no-store")
		} else {
			res.setHeader("Cache-Control", "public,max-age=31536000,immutable")
		}
		const mime = MimeTypes.lookup(path) || "application/octet-stream"
		const contentType = MimeTypes.contentType(mime) || "application/octet-stream"
		res.setHeader("Content-Type", contentType)
	}

	private resolveStaticFileName(path: string): string {
		if(path.endsWith("/")){
			path += "index.html"
		}

		if(path.startsWith("/")){ // probably
			path = "." + path
		}
		path = Path.resolve(this.opts.httpRoot, path)

		if(!isPathInsidePath(path, this.opts.httpRoot)){
			throw new Error("Weird request path not inside root dir: " + path)
		}

		return path
	}


	private async processStaticRequestByProxy(path: string, proxyRoot: string, res: Http.ServerResponse): Promise<void> {
		const resolvedUrl = new URL(path, proxyRoot)
		const result = await httpGet(resolvedUrl)
		this.addStaticHeaders(this.resolveStaticFileName(path), res, true)
		res.end(result)
	}

	private async processStaticRequestByFile(resourcePath: string, res: Http.ServerResponse): Promise<void> {
		resourcePath = this.resolveStaticFileName(resourcePath)

		try {
			const readStream = Fs.createReadStream(resourcePath)
			this.addStaticHeaders(resourcePath, res, false)
			readStream.pipe(res)
			await waitReadStreamToEnd(readStream)
			await waitRequestEnd(res)
		} catch(e){
			if(isEnoent(e)){
				await endRequest(res, 404, "No Such File You Fool")
			} else {
				throw e
			}
		}

	}

	private async getApiBody(req: Http.IncomingMessage, url: URL): Promise<Record<string, unknown>> {
		let argsObj: Record<string, unknown>
		if(req.method === "GET" || req.method === "PUT"){
			argsObj = {}
			for(const [k, v] of url.searchParams.entries()){
				argsObj[k] = v
			}
			if(req.method === "PUT"){
				argsObj["data"] = await readStreamToBuffer(req, this.opts.inputSizeLimit, this.opts.readTimeoutSeconds * 1000)
			}
		} else {
			const body = await readStreamToBuffer(req, this.opts.inputSizeLimit, this.opts.readTimeoutSeconds * 1000)
			argsObj = JSON.parse(body.toString("utf-8"))
		}
		return argsObj
	}

	private async processApiRequest(url: URL, req: Http.IncomingMessage, res: Http.ServerResponse): Promise<void> {
		const methodName = url.pathname.substring(this.opts.apiRoot.length)
		const apiMethod = this.opts.apiMethods[methodName]
		if(!apiMethod){
			return await endRequest(res, 404, "Your Api Call Sucks")
		}

		const methodArgs = await this.getApiBody(req, url)
		let result: RequestRunResult<unknown> | null = null
		let error: Error | null = null
		try {
			result = await this.opts.runRequestHandler(req, async() => {
				let callResult: unknown
				if(apiMethod.length === 0){
					const keys = Object.keys(methodArgs)
					if(keys.length > 0){
						throw new ApiError("validation_not_passed", `Method ${methodName} does not expect any arguments (was passed: ${keys.join(", ")})`)
					}
					callResult = (apiMethod as (() => unknown))()
				} else {
					callResult = apiMethod(methodArgs)
				}

				return await Promise.resolve(callResult)
			}, methodName, methodArgs)
		} catch(e){
			if(e instanceof Error){
				let err: Error = e
				if(err instanceof RCV.Error){
					err = new ApiError("validation_not_passed", e.message)
				}
				const errStr = ApiError.isApiError(err) ? err.message : err.stack || err.message
				log(`Error calling ${methodName}(${apiMethodArgsToString(methodArgs)}): ${errStr}`)
				error = err
			} else {
				throw e
			}
		}

		let resp: string | Buffer
		if(error || !result){
			resp = JSON.stringify(errorToErrorApiResp(error ?? new Error("No error, but no response either")))
			await endRequest(res, 500, "Server Error", resp)
		} else {
			if(result.body instanceof Buffer){
				resp = result.body
			} else {
				const apiResp: ApiResponse<Required<typeof result>["body"]> = {result: result.body ?? null}
				resp = JSON.stringify(apiResp)
			}
			for(const newCookie of (result.cookie ?? [])){
				res.setHeader("Set-Cookie", newCookie)
			}
			for(const [headerName, rawValue] of Object.entries(result.headers ?? {})){
				if(rawValue === undefined){
					continue
				}
				for(const value of Array.isArray(rawValue) ? rawValue : [rawValue]){
					res.setHeader(headerName, value)
				}
			}
			if(result.redirectUrl){
				res.setHeader("Location", result.redirectUrl)
				await endRequest(res, 302, "Redirect", resp)
			} else {
				await endRequest(res, 200, "OK", resp)
			}
		}
	}

}

function waitRequestEnd(res: Http.ServerResponse): Promise<void> {
	return new Promise(ok => res.end(ok))
}

function endRequest(res: Http.ServerResponse, code: number, codeStr: string, body: string | Buffer = "OwO", headers?: Record<string, string>): Promise<void> {
	return new Promise(ok => {
		res.writeHead(code, codeStr, headers)
		if(typeof(body) === "string"){
			res.end(body, "utf-8", ok)
		} else {
			res.end(body, ok)
		}
	})
}

function waitReadStreamToEnd(stream: Fs.ReadStream): Promise<void> {
	return new Promise((ok, bad) => {
		stream.on("error", e => bad(e))
		stream.on("end", () => ok())
	})
}

export function apiMethodArgsToString(methodArgs: Record<string, unknown>): string {
	return Object.entries(methodArgs).map(([k, v]) => {
		return k + ": " + (v instanceof Uint8Array ? "<binary>" : JSON.stringify(v))
	}).join(", ")
}