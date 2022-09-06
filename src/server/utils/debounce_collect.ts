export interface DebouncedCollector<T> {
	(value: T): void
	waitInvocationsOver(): Promise<void>
}

export function makeDebounceCollector<T>(debounceTime: number, handler: (values: T[]) => void): DebouncedCollector<T> {
	let collection = [] as T[]
	let timer: ReturnType<typeof setTimeout> | null = null
	let invocationOverWaiters = null as null | ((err?: unknown) => void)[]

	function runDebouncedCollector(): void {
		let err = undefined as unknown | undefined
		try {
			timer = null
			const coll = collection
			collection = []
			handler(coll)
		} catch(e){
			err = e
		} finally {
			if(invocationOverWaiters && !timer){
				const waiters = invocationOverWaiters
				invocationOverWaiters = null
				for(const waiter of waiters){
					waiter(err)
				}
			}
		}
	}

	const fn = (value: T) => {
		collection.push(value)
		if(!timer){
			timer = setTimeout(runDebouncedCollector, debounceTime)
		}
	}

	return Object.assign(fn, {
		waitInvocationsOver: () => {
			if(!timer){
				return Promise.resolve()
			} else {
				return new Promise<void>((ok, bad) => {
					(invocationOverWaiters ||= []).push(err => err ? bad(err) : ok())
				})
			}
		}
	})
}