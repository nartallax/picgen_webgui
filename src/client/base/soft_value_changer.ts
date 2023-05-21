import {WBox} from "@nartallax/cardboard"

export class SoftValueChanger {
	private desiredValue: number
	private startValue: number
	private isRunning = false
	private startTime = 0

	constructor(readonly value: WBox<number>, readonly timeMs: number) {
		this.startValue = value()
		this.desiredValue = value()
	}

	set(newValue: number): void {
		this.desiredValue = newValue
		this.tryRestartUpdates()
	}

	private tryRestartUpdates(): void {
		this.startTime = Date.now()
		this.startValue = this.value()

		const update = () => {
			const now = Date.now()
			const progress = (now - this.startTime) / this.timeMs
			if(progress >= 1){
				this.value(this.desiredValue)
				this.isRunning = false
				return
			}

			this.value(this.startValue + ((this.desiredValue - this.startValue) * progress))
			requestAnimationFrame(update)
		}

		if(!this.isRunning){
			this.isRunning = true
			requestAnimationFrame(update)
		}
	}
}