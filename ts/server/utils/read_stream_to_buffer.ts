import * as Fs from "fs"
import * as Http from "http"

export class SizeLimitExceededError extends Error {}

export function readStreamToBuffer(stream: Fs.ReadStream | Http.IncomingMessage, limit: number, timeout: number): Promise<Buffer> {
	return new Promise((ok, bad) => {
		try {
			const abort = (err: Error) => {
				bad(err)
				if(stream instanceof Fs.ReadStream){
					stream.close()
				} else {
					stream.destroy()
				}
				if(timeoutHandle){
					clearTimeout(timeoutHandle)
				}
			}

			const complete = () => {
				ok(Buffer.concat(chunks, size))
				if(timeoutHandle){
					clearTimeout(timeoutHandle)
				}
			}

			const timeoutHandle = setTimeout(() => abort(new Error("Read timed out")), timeout)

			let size = 0
			const chunks = [] as Buffer[]
			stream.on("data", chunk => {
				if(!(chunk instanceof Buffer)){
					abort(new Error("Chunk is not buffer!"))
					return
				}

				chunks.push(chunk)

				size += chunk.length
				if(size > limit){
					abort(new SizeLimitExceededError("Expected no more than " + limit + " bytes, got " + size + " instead"))
					return
				}
			})

			stream.once("error", err => bad(err))
			stream.once("end", complete)
		} catch(e){
			bad(e)
		}
	})
}