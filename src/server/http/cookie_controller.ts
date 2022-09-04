import * as Http from "http"

interface CookieUpdate {
	name: string
	value: string | null
}

const forceExpireCookieAttr = "expires=Thu, 01 Jan 1970 00:00:00 GMT"
// could also add `secure` here, but this app won't be always hosted over https. oh well.
const defaultCookieAttr = "path=/; httponly"

export class CookieController {

	private values: Record<string, string> = {}

	constructor(req: Http.IncomingMessage) {
		const cookieHeader = req.headers.cookie
		if(cookieHeader){
			for(const part of cookieHeader.split(/;\s*/)){
				const kv = part.split("=")
				if(kv.length !== 2){
					continue
				}
				const [k, v] = kv
				this.values[decodeURIComponent(k!)] = decodeURIComponent(v!)
			}
		}

	}

	private cookieUpdates = [] as CookieUpdate[]

	get(name: string): string | undefined {
		return this.values[name]
	}

	set(name: string, value: string): void {
		this.cookieUpdates.push({name, value})
		this.values[name] = value
	}

	delete(name: string): void {
		this.cookieUpdates.push({name, value: null})
		delete this.values[name]
	}

	/** Makes all known updates to cookies a list of Set-Cookie lines
	 * After that, list of known updates is cleared */
	harvestSetCookieLines(): string[] {
		const result = this.cookieUpdates.map(({name, value}) => {
			name = encodeURIComponent(name)
			if(value !== null){
				return `${name}=${encodeURIComponent(value)}; ${defaultCookieAttr}`
			} else {
				return `${name}=del; ${defaultCookieAttr}; ${forceExpireCookieAttr}`
			}
		})

		this.cookieUpdates.length = 0

		return result
	}

}