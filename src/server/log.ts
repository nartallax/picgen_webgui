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