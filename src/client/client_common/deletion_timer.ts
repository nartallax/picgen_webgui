import {WBox} from "@nartallax/cardboard"

interface DeletionTimer {
	cancel(): void
	run(): void
}

export function makeDeletionTimer(duration: number, box: WBox<number>, afterEnd: () => void): DeletionTimer {
	let rafHandle: ReturnType<typeof requestAnimationFrame> | null = null
	let startTime = 0

	const onFrame = () => {
		rafHandle = null
		const passedTime = Date.now() - startTime
		const passedPercent = passedTime / duration
		if(passedPercent >= 1){
			box.set(1)
			cancel()
			afterEnd()
			return
		}

		box.set(passedPercent)
		rafHandle = requestAnimationFrame(onFrame)
	}

	const cancel = () => {
		box.set(0)
		if(rafHandle){
			cancelAnimationFrame(rafHandle)
			rafHandle = null
		}
	}

	const run = () => {
		if(rafHandle){
			return
		}

		startTime = Date.now()
		onFrame()
	}

	return {run, cancel}
}