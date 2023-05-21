export function debounce<A extends any[]>(timeMs: number, fn: (...args: A) => void): (...args: A) => void {
	let timer: ReturnType<typeof setTimeout> | null = null
	let lastArgs: A | null = null

	return (...args) => {
		lastArgs = args
		if(timer === null){
			timer = setTimeout(() => {
				timer = null
				const args = lastArgs!
				lastArgs = null
				fn(...args)
			}, timeMs)
		}
	}
}