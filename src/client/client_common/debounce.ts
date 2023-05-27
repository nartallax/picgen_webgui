type DebouncedFn<T> = T & {
	isRunScheduled: boolean
	waitForScheduledRun: () => Promise<void>
}

export function debounce<A extends any[]>(timeMs: number, fn: (...args: A) => void): DebouncedFn<(...args: A) => void> {
	let timer: ReturnType<typeof setTimeout> | null = null
	let lastArgs: A | null = null

	let runWaiters: (() => void)[] = []

	const result = (...args: A) => {
		lastArgs = args
		if(timer === null){
			debouncedResult.isRunScheduled = true
			timer = setTimeout(() => {
				timer = null
				const args = lastArgs!
				lastArgs = null
				debouncedResult.isRunScheduled = false
				try {
					fn(...args)
				} finally {
					const waiters = runWaiters
					runWaiters = []
					for(const waiter of waiters){
						waiter()
					}
				}
			}, timeMs)
		}
	}

	const debouncedResult = result as DebouncedFn<(...args: A) => void>
	debouncedResult.isRunScheduled = false
	debouncedResult.waitForScheduledRun = () => new Promise(ok => {
		if(!debouncedResult.isRunScheduled){
			ok()
		} else {
			runWaiters.push(ok)
		}
	})

	return debouncedResult
}