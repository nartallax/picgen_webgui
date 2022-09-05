import * as CLS from "cls-hooked"
import {RequestContext} from "server/request_context"

let _ns: CLS.Namespace | null = null
let _nsName: string | null = null

export function initAsyncContext(name: string): void {
	if(_ns){
		throw new Error("Namespace already initialized!")
	}
	_nsName = name
	_ns = CLS.createNamespace(name)
}

const contextVarName = "context"

export function runInAsyncContext<T>(context: RequestContext, fn: () => T | Promise<T>): Promise<T> {
	const ns = _ns
	if(!ns){
		throw new Error("No namespace is created yet!")
	}
	return ns.runPromise(async() => {
		ns.set(contextVarName, context)
		try {
			return await Promise.resolve(fn())
		} finally {
			ns.set(contextVarName, null)
		}
	})
}

export function closeAsyncContext(): void {
	if(_nsName){
		CLS.destroyNamespace(_nsName)
		_ns = null
		_nsName = null
	}
}

export function cont(): RequestContext {
	if(!_ns){
		throw new Error("No namespace context is present.")
	}
	const context: RequestContext | undefined = _ns.get(contextVarName)
	if(!context){
		throw new Error("No context is created for this async sequence")
	}
	return context
}