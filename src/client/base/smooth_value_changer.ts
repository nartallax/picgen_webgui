interface NumWBoxEssentials {
	get(): number
	set(value: number): void
}

interface Options {
	curvePower?: number
	int?: boolean
}

export class SmoothValueChanger {
	private lastKnownValue: number
	private startValue = 0
	private startTime = 0
	private targetValue = 0
	private frame: ReturnType<typeof requestAnimationFrame> | null = null


	constructor(private readonly box: NumWBoxEssentials, private readonly timeSpan: number, private readonly opts: Options = {}) {
		this.lastKnownValue = box.get()
		this.targetValue = this.lastKnownValue
	}

	private updateRunner(): void {
		if(this.box.get() !== this.targetValue){
			if(!this.frame){
				this.lastKnownValue = this.box.get()
				this.frame = requestAnimationFrame(this.onTick)
			}
		} else if(this.frame){
			cancelAnimationFrame(this.frame)
		}
	}

	private onTick = () => {
		this.frame = null

		if(this.box.get() !== this.lastKnownValue){
			// something else changed value of the box, we must yield
			this.lastKnownValue = this.targetValue = this.box.get()
			return
		}

		const timePassed = Date.now() - this.startTime
		const linearProgress = timePassed / this.timeSpan
		if(linearProgress >= 1){
			this.lastKnownValue = this.targetValue
			this.box.set(this.lastKnownValue)
			return
		}

		const curvedProgress = 1 - ((1 - linearProgress) ** (this.opts.curvePower ?? 1))
		let newValue = this.startValue + ((this.targetValue - this.startValue) * curvedProgress)
		if(this.opts.int){
			newValue = Math.round(newValue)
		}
		this.lastKnownValue = newValue
		this.box.set(this.lastKnownValue)
		this.frame = requestAnimationFrame(this.onTick)
	}

	set(newValue: number): void {
		this.startValue = this.box.get()
		this.startTime = Date.now()
		this.targetValue = newValue
		if(this.opts.int){
			this.targetValue = Math.round(this.targetValue)
		}
		this.updateRunner()
	}

	get(): number {
		return this.targetValue
	}
}