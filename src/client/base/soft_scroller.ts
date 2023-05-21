import {RBox, box} from "@nartallax/cardboard"
import {onMount} from "@nartallax/cardboard-dom"

export class SoftScroller {
	private readonly atStart = box(false)
	private readonly atFinish = box(false)
	private readonly limit = box(0)
	private readonly position = box(0)
	private readonly contentSize = box(0)

	get isAtStart(): RBox<boolean> {
		return this.atStart
	}
	get isAtFinish(): RBox<boolean> {
		return this.atFinish
	}
	get scrollLimit(): RBox<number> {
		return this.limit
	}
	get scrollableContentSize(): RBox<number> {
		return this.contentSize
	}
	get scrollPosition(): RBox<number> {
		return this.position
	}

	private desiredPosition: number
	private startPosition: number
	private scrollIsRunning = false
	private startTime = 0

	constructor(readonly el: HTMLElement, readonly axis: "x" | "y", readonly timeMs: number) {
		this.refresh()
		this.desiredPosition = this.getPosition()
		this.startPosition = this.desiredPosition

		onMount(el, () => {
			const refresh = this.refresh.bind(this)
			requestAnimationFrame(refresh)

			el.addEventListener("scroll", refresh)

			const resizeObserver = new ResizeObserver(refresh)
			resizeObserver.observe(el)

			const mutObserver = new MutationObserver(() => {
				this.refresh()
				this.tryWaitLoadAll()
			})
			mutObserver.observe(el, {subtree: true, childList: true})
			this.tryWaitLoadAll()

			return () => {
				el.removeEventListener("scroll", refresh)
				resizeObserver.disconnect()
				mutObserver.disconnect()
			}
		})
	}

	scrollTo(position: number): void {
		this.desiredPosition = Math.min(this.getLimit(), Math.max(0, position))
		this.tryRestartScroll()
	}

	scroll(diff: number): void {
		const startPosition = this.scrollIsRunning ? this.desiredPosition : this.getPosition()
		this.scrollTo(startPosition + diff)
	}

	// this is a bit of a hack
	// problem is that it's hard to properly track change in scrollable amount
	// so we go by this weird particular means of "let's wait until image is loaded and assume that scroll amount changed"
	private tryWaitLoadAll(): void {
		const imgs = this.el.querySelectorAll("img")
		for(let i = 0; i < imgs.length; i++){
			this.tryWaitLoad(imgs[i]!)
		}
	}

	private tryWaitLoad(el: HTMLElement): void {
		if(!(el instanceof HTMLImageElement) || el.complete || el.getAttribute("data-scroller-processed") === "true"){
			return
		}
		el.setAttribute("data-scroller-processed", "true")

		const waiter = () => {
			el.removeEventListener("load", waiter)
			this.refresh()
		}
		el.addEventListener("load", waiter)
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
		this.refresh()
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

	refresh(): void {
		const pos = this.getPosition()
		const limit = this.getLimit()
		this.atStart(pos <= 0)
		this.atFinish(pos >= limit)
		this.limit(limit)
		this.position(pos)
		this.contentSize(this.getScrollSize())
	}

}