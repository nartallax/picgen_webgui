import {RBox, box} from "@nartallax/cardboard"
import {onMount} from "@nartallax/cardboard-dom"

export class SoftScroller {
	private readonly atStart = box(false)
	private readonly atFinish = box(false)
	get isAtStart(): RBox<boolean> {
		return this.atStart
	}
	get isAtFinish(): RBox<boolean> {
		return this.atFinish
	}

	private desiredPosition: number
	private startPosition: number
	private scrollIsRunning = false
	private startTime = 0

	constructor(readonly el: HTMLElement, readonly axis: "x" | "y", readonly timeMs: number) {
		this.updateBoxes()
		this.desiredPosition = this.getPosition()
		this.startPosition = this.desiredPosition

		onMount(el, () => requestAnimationFrame(() => this.updateBoxes()))
	}

	scroll(diff: number) {
		this.desiredPosition = Math.min(this.getLimit(), Math.max(0, this.desiredPosition + diff))
		this.tryRestartScroll()
	}

	private tryRestartScroll(): void {
		const pos = this.getPosition()
		if(this.desiredPosition === pos){
			return
		}
		this.startTime = Date.now()
		this.startPosition = pos

		const updateScroll = () => {
			const now = Date.now()
			const progress = (now - this.startTime) / this.timeMs
			if(progress >= 1){
				this.setPosition(this.desiredPosition)
				this.scrollIsRunning = false
				return
			}

			this.setPosition(this.startPosition + ((this.desiredPosition - this.startPosition) * progress))
			requestAnimationFrame(updateScroll)
		}

		if(!this.scrollIsRunning){
			this.scrollIsRunning = true
			requestAnimationFrame(updateScroll)
		}
	}

	private getPosition(): number {
		return this.axis === "x" ? this.el.scrollLeft : this.el.scrollTop
	}

	private setPosition(value: number): void {
		if(this.axis === "x"){
			this.el.scrollLeft = value
		} else {
			this.el.scrollTop = value
		}
		this.updateBoxes()
	}

	private getViewportSize(): number {
		return this.axis === "x" ? this.el.clientWidth : this.el.clientHeight
	}

	private getScrollSize(): number {
		return this.axis === "x" ? this.el.scrollWidth : this.el.scrollHeight
	}

	private getLimit(): number {
		return this.getScrollSize() - this.getViewportSize()
	}

	private updateBoxes(): void {
		const pos = this.getPosition()
		this.atStart(pos <= 0)
		this.atFinish(pos >= this.getLimit())
	}

}