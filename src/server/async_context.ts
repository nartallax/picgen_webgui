import * as CLS from "cls-hooked"
import {RequestContext, UserlessContext} from "server/request_context"

let _ns: CLS.Namespace | null = null
let _nsName: string | null = null

export function initAsyncContext(name: string): void {
	if(_ns){
		throw new Error("Namespace already initialized!")
	}
	_nsName = name
	_ns = CLS.createNamespace(name)
}

const requestContextVarName = "context"
const userlessContextVarName = "userless_context"

export function runInAsyncContext<T>(context: RequestContext | UserlessContext, fn: () => T | Promise<T>): Promise<T> {
	const ns = _ns
	if(!ns){
		throw new Error("No namespace is created yet!")
	}
	return ns.runPromise(async() => {
		const varName = context instanceof RequestContext ? requestContextVarName : userlessContextVarName
		ns.set(varName, context)
		try {
			return await Promise.resolve(fn())
		} finally {
			ns.set(varName, null)
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
	const context: RequestContext | undefined = _ns.get(requestContextVarName)
	if(!context){
		throw new Error("No context is created for this async sequence")
	}
	return context
}

export function userlessCont(): UserlessContext {
	if(!_ns){
		throw new Error("No namespace context is present.")
	}
	const context: UserlessContext | undefined = _ns.get(userlessContextVarName)
	if(!context){
		throw new Error("No userless context is created for this async sequence")
	}
	return context
}