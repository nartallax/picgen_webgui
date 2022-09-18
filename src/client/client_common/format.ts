export function formatTimeSpan(timeSeconds: number): string {
	let time = timeSeconds
	const seconds = time % 60
	time = (time - seconds) / 60
	const minutes = time % 60
	const hours = (time - minutes) / 60
	return (hours > 0 ? td(hours) + ":" : "") + td(minutes) + ":" + td(seconds)
}

const td = (x: number) => (x > 9 ? "" : "0") + x