type Options = {
	readonly getValue: () => number
	readonly setValue: (value: number) => void
	readonly timeMs: number
}

export class SoftValueChanger {
	private desiredValue: number
	private startValue: number
	private isRunning = false
	private startTime = 0

	get currentTargetValue(): number {
		return this.desiredValue
	}

	constructor(readonly opts: Options) {
		this.startValue = opts.getValue()
		this.desiredValue = opts.getValue()
	}

	reset(): void {
		this.desiredValue = this.opts.getValue()
		this.isRunning = false
	}

	set(newValue: number): void {
		this.desiredValue = newValue
		this.tryRestartUpdates()
	}

	change(diff: number): void {
		this.desiredValue += diff
		this.tryRestartUpdates()
	}

	private tryRestartUpdates(): void {
		if(this.opts.getValue() === this.desiredValue){
			this.isRunning = false
			return
		}

		this.startTime = Date.now()
		this.startValue = this.opts.getValue()

		const update = () => {
			if(!this.isRunning){
				return
			}

			const now = Date.now()
			const progress = (now - this.startTime) / this.opts.timeMs
			if(progress >= 1){
				this.opts.setValue(this.desiredValue)
				this.isRunning = false
				return
			}

			const value = this.startValue + ((this.desiredValue - this.startValue) * progress)
			this.opts.setValue(value)
			requestAnimationFrame(update)
		}

		if(!this.isRunning){
			this.isRunning = true
			requestAnimationFrame(update)
		}
	}
}