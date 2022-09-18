export function limitClickRate(handler: (this: HTMLElement, evt: MouseEvent) => void, ms = 1000): (this: HTMLElement, evt: MouseEvent) => void {
	return limitRateToOncePer(ms, handler)
}

export function limitRateToOncePer<T, A extends unknown[] = []>(ms: number, handler: (this: T, ...args: A) => void): (this: T, ...args: A) => void {
	let lastCallTime = 0
	return function rateLimiterWrapper(this: T, ...args: A): void {
		const now = Date.now()
		if(now - lastCallTime < ms){
			return
		}
		lastCallTime = now
		handler.call(this, ...args)
	}
}