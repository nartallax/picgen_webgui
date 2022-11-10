function nowStr(): string {
	const d = new Date()
	return `${d.getFullYear()}.${td(d.getMonth() + 1)}.${td(d.getDate())} ${td(d.getHours())}:${td(d.getMinutes())}:${td(d.getSeconds())}:${threed(d.getMilliseconds())}`
}

const td = (x: number) => (x > 9 ? "" : "0") + x
const threed = (x: number) => (x > 99 ? "" : x > 9 ? "0" : "00") + x

export function log(str: string): void {
	process.stderr.write(nowStr())
	process.stderr.write(" | ")
	process.stderr.write(str)
	process.stderr.write("\n")
}

export function logError(e: unknown): void {
	log(e instanceof Error ? e.stack || e.message : (e + ""))
}

export function wrapInCatchLog<T extends unknown[]>(fn: (...args: T) => void): (...args: T) => Promise<void> {
	return async(...args) => {
		try {
			await Promise.resolve(fn(...args))
		} catch(e){
			logError(e)
		}
	}
}

export function runInCatchLog(fn: () => void | Promise<void>): Promise<void> {
	return wrapInCatchLog(fn)()
}