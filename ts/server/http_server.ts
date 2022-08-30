import * as Http from "http"
import * as Path from "path"
import * as Fs from "fs"
import {Runtyper} from "@nartallax/runtyper"
import {isPathInsidePath} from "server/utils/is_path_inside_path"
import {isEnoent} from "server/utils/is_enoent"
import {errToString} from "server/utils/err_to_string"
import {readStreamToBuffer} from "server/utils/read_stream_to_buffer"

interface HttpServerOptions {
	readonly port: number
	readonly httpRoot: string
	readonly cacheDuration: number
	readonly apiRoot: string
	readonly inputSizeLimit: number
	readonly readTimeoutSeconds: number
	readonly apiMethods: {
		readonly [name: string]: (...args: never[]) => (unknown | Promise<unknown>)
	}
}

export class HttpServer {

	private readonly server: Http.Server
	private readonly validators: {readonly [name: string]: ReturnType<typeof Runtyper.getObjectParameterChecker>}

	constructor(private readonly opts: HttpServerOptions) {
		this.server = new Http.Server((req, res) => this.processRequest(req, res))

		const validators = {} as Record<string, ReturnType<typeof Runtyper.getObjectParameterChecker>>
		for(const apiMethodName in opts.apiMethods){
			const apiFn = opts.apiMethods[apiMethodName]!
			const validator = Runtyper.getObjectParameterChecker(apiFn)
			validators[apiMethodName] = validator
		}
		this.validators = validators

		Runtyper.cleanup()
	}

	start(): Promise<number> {
		return new Promise((ok, bad) => {
			try {
				this.server.listen(this.opts.port, () => {
					const addr = this.server.address()
					if(!addr || typeof(addr) !== "object"){
						bad(new Error("Server address is not an object: " + addr))
						return
					}
					ok(addr.port)
				})
			} catch(e){
				bad(e)
			}
		})
	}

	private async processRequest(req: Http.IncomingMessage, res: Http.ServerResponse): Promise<void> {
		try {
			req.on("error", err => console.error("Error on HTTP request: " + errToString(err)))
			res.on("error", err => console.error("Error on HTTP response: " + errToString(err)))

			const method = req.method
			if(!method){
				return await endRequest(res, 400, "Where Is The Method Name You Fucker")
			}

			const urlStr = req.url || "/"
			const url = new URL(urlStr, "http://localhost")
			const path = url.pathname
			switch(method.toUpperCase()){
				case "GET":
					await this.processStaticRequest(path, res)
					return
				case "POST":
					await this.processApiRequest(path, req, res)
					return
				default:
					await endRequest(res, 405, "Your Method Name Sucks")
					return
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

	private async processApiRequest(path: string, req: Http.IncomingMessage, res: Http.ServerResponse): Promise<void> {
		if(!path.startsWith(this.opts.apiRoot)){
			return await endRequest(res, 404, "Your Api Call Sucks")
		}

		const methodName = path.substring(this.opts.apiRoot.length)
		const apiMethod = this.opts.apiMethods[methodName]
		if(!apiMethod){
			return await endRequest(res, 404, "Your Api Call Sucks")
		}

		// TODO: multipart/form-data here
		const body = await readStreamToBuffer(req, this.opts.inputSizeLimit, this.opts.readTimeoutSeconds * 1000)
		const parsedBody = JSON.parse(body.toString("utf-8"))
		const validator = this.validators[methodName]!
		const methodArgs = validator(parsedBody)
		const result = await Promise.resolve(apiMethod(...methodArgs as never[]))
		await endRequest(res, 200, "OK", JSON.stringify(result))
	}

}

function waitRequestEnd(res: Http.ServerResponse): Promise<void> {
	return new Promise((ok, bad) => {
		try {
			res.end(ok)
		} catch(e){
			bad(e)
		}
	})
}

function endRequest(res: Http.ServerResponse, code: number, codeStr: string, body: string | Buffer = "OwO", headers?: Record<string, string>): Promise<void> {
	return new Promise((ok, bad) => {
		try {
			res.writeHead(code, codeStr, headers)
			if(typeof(body) === "string"){
				res.end(body, "utf-8", ok)
			} else {
				res.end(body, ok)
			}
		} catch(e){
			bad(e)
		}
	})
}

function waitReadStreamToEnd(stream: Fs.ReadStream): Promise<void> {
	return new Promise((ok, bad) => {
		try {
			stream.on("error", e => bad(e))
			stream.on("end", () => ok())
		} catch(e){
			bad(e)
		}
	})
}