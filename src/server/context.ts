import type {DbConnection} from "server/db/db_controller"
import {CookieController} from "server/http/cookie_controller"
import type * as Http from "http"
import {config, context, dbController} from "server/server_globals"
import {logError} from "server/log"

export type Context = MinimalContext | HttpRequestContext

export interface MinimalContext {
	readonly cache: Record<string, unknown>
	readonly onClosed: (() => void)[]
	readonly hasHttpRequest: false
	readonly db: DbConnection
}
function withMinimalContext<T>(db: DbConnection | null, handler: (context: MinimalContext) => T | Promise<T>): Promise<T> {
	const doWithDb = async(db: DbConnection) => {
		const onClosed: MinimalContext["onClosed"] = []
		try {
			return await handler({
				hasHttpRequest: false,
				db,
				cache: {},
				onClosed
			})
		} finally {
			for(const closer of onClosed){
				try {
					await Promise.resolve(closer())
				} catch(e){
					logError(e)
				}
			}
		}
	}

	if(db){
		return doWithDb(db)
	} else {
		return dbController.inTransaction(doWithDb)
	}

}
export function runWithMinimalContext<T>(runner: (ctx: MinimalContext) => T | Promise<T>): Promise<T> {
	return withMinimalContext(null, ctx => context.run(ctx, () => runner(ctx)))
}
export function runWithMinimalContextWithDb<T>(db: DbConnection, runner: (ctx: MinimalContext) => T | Promise<T>): Promise<T> {
	return withMinimalContext(db, ctx => context.run(ctx, () => runner(ctx)))
}

export interface HttpRequestContext extends Omit<MinimalContext, "hasHttpRequest"> {
	readonly hasHttpRequest: true
	readonly cookie: CookieController
	readonly requestUrl: URL
	readonly responseHeaders: Http.OutgoingHttpHeaders
	redirectUrl: string | null
}
function withHttpRequestContext<T>(req: Http.IncomingMessage, handler: (context: HttpRequestContext) => T | Promise<T>): Promise<T> {
	const urlStr = req.url || "/"
	const hostHeader = req.headers.host
	if(!hostHeader){
		throw new Error("Host header is not present.")
	}
	const url = new URL(urlStr, (config.haveHttps ? "https" : "http") + "://" + hostHeader)
	return withMinimalContext(null, ctx => handler({
		...ctx,
		cookie: new CookieController(req),
		hasHttpRequest: true,
		responseHeaders: {},
		requestUrl: url,
		redirectUrl: null
	}))
}
export function runWithHttpRequestContext<T>(req: Http.IncomingMessage, runner: (ctx: HttpRequestContext) => T | Promise<T>): Promise<T> {
	return withHttpRequestContext(req, ctx => context.run(ctx, () => runner(ctx)))
}

export function getHttpContext(): HttpRequestContext {
	const ctx = context.get()
	if(!ctx.hasHttpRequest){
		throw new Error("Cannot call this method in non-http context")
	}
	return ctx
}