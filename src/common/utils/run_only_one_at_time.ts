export interface RunOnlyOneAtTimeFn {
	(): Promise<void>
	callCount: number
}

/** This function is a wrapper that runs passed function when called.
 * If the wrapper is called when it is already running, it will wait until the end of the call
 * and then run nested function again.
 * If the wrapper is called when there's already a call scheduled, it will ignore that call.
 *
 * Will swallow intermediate errors when they happen.
 *
 * @returns Promise is resolved when no more calls are in progress or scheduled.
 * */
export function runOnlyOneAtTime(handler: () => Promise<void>): RunOnlyOneAtTimeFn {
	let finishHandlers: {ok: () => void, err: (err: Error) => void}[] = []

	let isCallInProgress = false
	let isCallScheduled = false

	function callFinishHandlers(err: Error | null): void {
		const h = finishHandlers
		finishHandlers = []
		for(const handler of h){
			if(err){
				handler.err(err)
			} else {
				handler.ok()
			}
		}
	}

	async function tryMakeCall(): Promise<void> {
		if(isCallInProgress){
			isCallScheduled = true
			return
		}

		let resultingError: Error | null = null
		isCallInProgress = true
		try {
			result.callCount++
			await handler()
		} catch(e){
			if(e instanceof Error){
				resultingError = e
			} else {
				throw e
			}
		} finally {
			isCallInProgress = false
		}

		if(isCallScheduled){
			isCallScheduled = false
			tryMakeCall()
			return
		}

		callFinishHandlers(resultingError)
	}

	const result = (() => {
		const result = new Promise<void>((ok, err) => finishHandlers.push({ok, err}))
		tryMakeCall()
		return result
	}) as RunOnlyOneAtTimeFn

	result.callCount = 0

	return result
}