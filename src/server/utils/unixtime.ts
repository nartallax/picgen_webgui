export function unixtime(): number {
	return Math.floor(Date.now() / 1000)
}