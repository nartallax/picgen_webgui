import * as Http from "http"
import * as Path from "path"
import * as Fs from "fs"
import {Runtyper} from "@nartallax/runtyper"
import {isPathInsidePath} from "server/utils/is_path_inside_path"
import {isEnoent} from "server/utils/is_enoent"
import {errToString} from "server/utils/err_to_string"
import {readStreamToBuffer} from "server/utils/read_stream_to_buffer"
import {RequestContext, RequestContextFactory} from "server/request_context"
import {ApiResponse} from "common/common_types"
import {ApiError, errorToErrorApiResp} from "common/api_error"
import {log} from "server/log"

interface HttpServerOptions {
	readonly port: number
	readonly host?: string
	readonly httpRoot: string
	readonly cacheDuration: number
	readonly apiRoot: string
	readonly inputSizeLimit: number
	readonly readTimeoutSeconds: number
	readonly apiMethods: {
		readonly [name: string]: (...args: never[]) => (unknown | Promise<unknown>)
	}
	readonly contextFactory: RequestContextFactory
}

export class HttpServer {

	readonly server: Http.Server
	private readonly validators: {readonly [name: string]: ReturnType<typeof Runtyper.getObjectParameterChecker>}

	constructor(private readonly opts: HttpServerOptions) {
		this.server = new Http.Server((req, res) => this.processRequest(req, res))

		const validators = {} as Record<string, ReturnType<typeof Runtyper.getObjectParameterChecker>>
		for(const apiMethodName in opts.apiMethods){
			const apiFn = opts.apiMethods[apiMethodName]!
			const validator = Runtyper.getObjectParameterChecker(apiFn, {
				onUnknown: "allow_anything" // just to pass Buffer without extreme type bloat
			})
			validators[apiMethodName] = validator
		}
		this.validators = validators
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
						await this.processStaticRequest(path, res)
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

	private async processStaticRequest(resourcePath: string, res: Http.ServerResponse): Promise<void> {
		if(resourcePath.endsWith("/")){
			resourcePath += "index.html"
		}
		if(resourcePath.startsWith("/")){ // probably
			resourcePath = "." + resourcePath
		}
		resourcePath = Path.resolve(this.opts.httpRoot, resourcePath)
		if(!isPathInsidePath(resourcePath, this.opts.httpRoot)){
			return await endRequest(res, 403, "Ehehe No Path Tricks Allowed")
		}

		try {
			const readStream = Fs.createReadStream(resourcePath)
			res.writeHead(200, "OK", {
				"Cache-Control": this.makeCacheControlHeader(resourcePath.toLowerCase().endsWith(".html") ? 0 : this.opts.cacheDuration)
			})
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

	private makeCacheControlHeader(maxAge: number): string {
		if(maxAge < 1){
			return "max-age=0, no-store"
		} else {
			return `max-age=${Math.round(maxAge)}`
		}
	}

	private async getApiBody(methodName: string, req: Http.IncomingMessage, url: URL): Promise<unknown[]> {
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
		const validator = this.validators[methodName]!
		return validator(argsObj)
	}

	private async processApiRequest(url: URL, req: Http.IncomingMessage, res: Http.ServerResponse): Promise<void> {
		const methodName = url.pathname.substring(this.opts.apiRoot.length)
		const apiMethod = this.opts.apiMethods[methodName]
		if(!apiMethod){
			return await endRequest(res, 404, "Your Api Call Sucks")
		}

		const methodArgs = await this.getApiBody(methodName, req, url)
		let result: unknown = null
		let error: Error | null = null
		let context: RequestContext | null = null
		try {
			[result, context] = await this.opts.contextFactory(req, async context => {

				if((req.method ?? "GET").toUpperCase() !== "GET"){
					// if it goes through GET - it's not very important probably, no need to log
					const user = await context.user.mbGetCurrent()
					const userStr = !user ? "<anon>" : user.displayName
					log(`${userStr}: ${methodName}(${methodArgs.map(paramValue => {
						if(paramValue instanceof Buffer){
							return "<binary>"
						} else {
							return JSON.stringify(paramValue)
						}
					}).join(", ")})`)
				}

				return [await apiMethod(...methodArgs as never[]), context]
			})
		} catch(e){
			if(e instanceof Error){
				const errStr = ApiError.isApiError(e) ? e.message : e.stack || e.message
				const fixedMethodArgs = methodArgs.map(x => x instanceof Buffer ? "<binary>" : JSON.stringify(x))
				log(`Error calling ${methodName}(${fixedMethodArgs.join(", ")}): ${errStr}`)
				error = e
			} else {
				throw e
			}
		}

		let resp: string | Buffer
		if(error){
			resp = JSON.stringify(errorToErrorApiResp(error))
			await endRequest(res, 500, "Server Error", resp)
		} else {
			if(result instanceof Buffer){
				resp = result
			} else {
				const apiResp: ApiResponse<typeof result> = {result: result === undefined ? null : result}
				resp = JSON.stringify(apiResp)
			}
			if(context){
				for(const newCookie of context.cookie.harvestSetCookieLines()){
					res.setHeader("Set-Cookie", newCookie)
				}
				for(const headerName in context.responseHeaders){
					const rawValue = context.responseHeaders[headerName]!
					for(const value of Array.isArray(rawValue) ? rawValue : [rawValue]){
						res.setHeader(headerName, value)
					}
				}
				if(context.redirectUrl){
					res.setHeader("Location", context.redirectUrl)
					await endRequest(res, 302, "Redirect", resp)
				} else {
					await endRequest(res, 200, "OK", resp)
				}
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