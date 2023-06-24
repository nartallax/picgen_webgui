import * as CLS from "cls-hooked"

/** Wrapper around CLS-hooked that allows to organize contexts */
export class ContextController<C> {

	readonly name = "Context controller"

	private ns: CLS.Namespace

	constructor(readonly namespaceName: string, readonly varName = "context") {
		this.ns = CLS.createNamespace(namespaceName)
	}

	stop(): void {
		CLS.destroyNamespace(this.namespaceName)
	}

	/* Run a runner in a context, returning value
	this method implies that no other context is present;
	it meant to be used as way to react to some external event */
	async run<T>(context: C, runner: () => T | Promise<T>): Promise<T> {
		return await this.runWithContext(context, runner)
	}

	private runWithContext<T>(context: C, runner: () => T | Promise<T>): Promise<T> {
		return this.ns.runPromise(async() => {
			this.ns.set(this.varName, context)
			try {
				return await Promise.resolve(runner())
			} finally {
				this.ns.set(this.varName, null)
			}
		})
	}

	get(): C {
		const value = this.ns.get(this.varName) as C | null
		if(!value){
			throw new Error("No context is present")
		}
		return value
	}

}