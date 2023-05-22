type XY = {x: number, y: number}

export function pointerEventsToClientCoords(e: MouseEvent | TouchEvent): XY {
	if(isTouchEvent(e)){
		const touch = (e.touches[0] ?? e.changedTouches[0])!
		return {
			x: touch.clientX,
			y: touch.clientY
		}
	} else {
		return {
			x: e.clientX,
			y: e.clientY
		}
	}
}

export function pointerEventsToOffsetCoords(e: MouseEvent | TouchEvent): XY | null {
	if(!(e.target instanceof HTMLElement)){
		return null
	}

	const rect = e.target.getBoundingClientRect() // performance may suck, but whatever
	const coords = pointerEventsToClientCoords(e)
	coords.x -= rect.left
	coords.y -= rect.top
	return coords
}

export function isTouchEvent(e: MouseEvent | TouchEvent): e is TouchEvent {
	return !!(e as TouchEvent).touches
}

export type MouseDragHandlerParams = {
	readonly element: HTMLElement | Window
	/** start() is called before first onMove
	 * it can return false; it means that the move will not start */
	start?: (e: MouseEvent | TouchEvent) => boolean | undefined
	stop?: (e: MouseEvent | TouchEvent) => void
	onMove(e: MouseEvent | TouchEvent): void
	onClick?: (e: MouseEvent | TouchEvent) => void
	/** If true, onMove will be invoked when down event happen */
	readonly downIsMove?: boolean
	/** If true, onMove will be invoked when up event happen */
	readonly upIsMove?: boolean
	/** Distance in pixels that cursor should pass in down state before start and onmove is called */
	readonly distanceBeforeMove?: number
	/** Expected movement direction.
	 * If after `distanceBeforeMove` is passed the direction of movement is not this - drag won't happen */
	readonly constraintDirection?: "horisontal" | "vertical"
}

/** This is a good way to add a mousemove handler to an element */
export function addMouseDragHandler(params: MouseDragHandlerParams): () => void {

	let startCoords = {x: 0, y: 0}
	const distanceBeforeMove2 = (params.distanceBeforeMove ?? 0) ** 2
	let isMoving = false
	let isClickingNow = false
	const isClickPreventionEnabled = params.element !== window

	function startMoving(e: MouseEvent | TouchEvent, isDown: boolean): boolean {
		isMoving = true
		if(!directionIsRight(startCoords, pointerEventsToClientCoords(e))){
			stopMoving(e, false)
			return false
		}
		if(params.start){
			if(params.start(e) === false){
				stopMoving(e, false)
				return false
			}
		}
		if(params.downIsMove && isDown){
			params.onMove(e)
		}
		return true
	}

	function stopMoving(e: MouseEvent | TouchEvent, isUp: boolean): void {
		window.removeEventListener("mousemove", onMove)
		window.removeEventListener("touchmove", onMove)
		window.removeEventListener("mouseup", onUp)
		window.removeEventListener("touchend", onUp)
		if(!isMoving && !isClickingNow){
			try {
				isClickingNow = true
				if(e.target instanceof HTMLElement && isClickPreventionEnabled){
					e.target.click()
				}
				if(params.onClick){
					params.onClick(e)
				}
			} finally {
				isClickingNow = false
			}
		}
		if(params.upIsMove && isUp && isMoving){
			params.onMove(e)
		}
		if(params.stop && isUp && isMoving){
			params.stop(e)
		}
		isMoving = false
	}

	function directionIsRight(startCoords: XY, currentCoords: XY): boolean {
		const dir = params.constraintDirection
		if(!dir){
			return true
		}
		const dx = Math.abs(startCoords.x - currentCoords.x)
		const dy = Math.abs(startCoords.y - currentCoords.y)
		const isHorisontal = dx >= dy
		return isHorisontal === (dir === "horisontal")
	}

	function targetIsRight(e: Event): boolean {
		return findDragTarget(e) === params.element
	}

	const onMove = (e: MouseEvent | TouchEvent): void => {
		if(!isMoving){
			const coords = pointerEventsToClientCoords(e)
			const distance2 = ((startCoords.x - coords.x) ** 2) + ((startCoords.y - coords.y) ** 2)
			if(distance2 >= distanceBeforeMove2){
				if(!startMoving(e, false)){
					return
				}
			} else {
				return
			}
		}
		params.onMove(e)
	}

	const onDown = (e: MouseEvent | TouchEvent): void => {
		if(!targetIsRight(e)){
			// handled by another mouse drag handler
			// in theory we could just mouseEvent.stopPropagation()
			// but that breaks when logic about "let's wait for some distance before start" is introduced
			// because when you decide to stop - it's already too late to prevent propagation
			return
		}
		window.addEventListener("mousemove", onMove, {passive: true})
		window.addEventListener("touchmove", onMove, {passive: true})
		window.addEventListener("mouseup", onUp, {passive: true})
		window.addEventListener("touchend", onUp, {passive: true})
		startCoords = pointerEventsToClientCoords(e)
		if(distanceBeforeMove2 <= 0){
			startMoving(e, true)
		}
	}

	const onUp = (e: MouseEvent | TouchEvent): void => {
		stopMoving(e, true)
	}

	// oh my fucking god.
	// this is needed because typescript cannot figure out .addEventListener on union type
	if(params.element instanceof HTMLElement){
		setDragTargetState(params.element, true)
		params.element.addEventListener("mousedown", onDown)
		params.element.addEventListener("touchstart", onDown)
	} else {
		params.element.addEventListener("mousedown", onDown)
		params.element.addEventListener("touchstart", onDown)
	}

	if(isClickPreventionEnabled){
		params.element.addEventListener("click", e => {
			if(!targetIsRight(e)){
				return
			}
			// console.log({isClickingNow}, e.target)
			if(!isClickingNow){
				e.stopPropagation()
			}
		}, {capture: true})
	}

	return () => {
		if(params.element instanceof HTMLElement){
			setDragTargetState(params.element, false)
			params.element.removeEventListener("mousedown", onDown)
			params.element.removeEventListener("touchstart", onDown)
		} else {
			params.element.removeEventListener("mousedown", onDown)
			params.element.removeEventListener("touchstart", onDown)
		}
	}
}

const dataAttrName = "data-is-drag-target"

function setDragTargetState(el: HTMLElement, isDragTarget: boolean): void {
	if(!isDragTarget){
		el.removeAttribute(dataAttrName)
	} else {
		el.setAttribute(dataAttrName, "true")
	}
}

function findDragTarget(e: Event): HTMLElement | Window {
	let el = e.target
	while(el){
		if(!(el instanceof HTMLElement)){
			if(el instanceof Node){
				el = el.parentNode
				continue
			}
			break
		}
		if(el.getAttribute(dataAttrName) === "true"){
			return el
		}
		if(!el.parentElement || el === el.parentElement){
			return window
		}
		el = el.parentNode
	}

	// fallback for weird cases
	return window
}