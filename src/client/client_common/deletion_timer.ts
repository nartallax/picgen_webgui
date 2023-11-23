import {WBox} from "@nartallax/cardboard"

export interface DeletionTimer {
	readonly isCompleted: boolean
	cancel(): void
	run(): void
	completeNow(): void
}

export function makeDeletionTimer(duration: number, box: WBox<number>, afterEnd: () => void): DeletionTimer {
	let rafHandle: ReturnType<typeof requestAnimationFrame> | null = null
	let startTime = 0

	const onFrame = () => {
		rafHandle = null
		const passedTime = Date.now() - startTime
		const passedPercent = passedTime / duration
		if(passedPercent >= 1){
			completeNow()
			return
		}

		box.set(passedPercent)
		rafHandle = requestAnimationFrame(onFrame)
	}

	const cancel = (keepProgress?: boolean) => {
		if(!keepProgress){
			box.set(0)
		}
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

	const completeNow = () => {
		box.set(1)
		cancel(true)
		afterEnd()
		result.isCompleted = true
	}

	const result = {run, cancel, completeNow, isCompleted: false}
	return result
}