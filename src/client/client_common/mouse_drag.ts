export function pointerEventsToClientCoords(e: MouseEvent | TouchEvent): {x: number, y: number} {
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

export function pointerEventsToOffsetCoords(e: MouseEvent | TouchEvent): {x: number, y: number} | null {
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

type MouseDragHandlerParams = {
	readonly element: HTMLElement | Window
	/** start() is called before first onMove
	 * it can return false; it means that the move will not start */
	start?: (e: MouseEvent | TouchEvent) => boolean | undefined
	stop?: (e: MouseEvent | TouchEvent) => void
	onMove(e: MouseEvent | TouchEvent): void
	/** If true, onMove will be invoked when down event happen */
	readonly downIsMove?: boolean
	/** If true, onMove will be invoked when up event happen */
	readonly upIsMove?: boolean
	/** Distance in pixels that cursor should pass in down state before start and onmove is called */
	readonly distanceBeforeMove?: number
}

/** This is a good way to add a mousemove handler to an element */
export function addMouseDragHandler(params: MouseDragHandlerParams): () => void {

	let startCoords = {x: 0, y: 0}
	const distanceBeforeMove2 = (params.distanceBeforeMove ?? 0) ** 2
	let isMoving = false

	function startMoving(e: MouseEvent | TouchEvent, isDown: boolean): boolean {
		isMoving = true
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
		if(params.upIsMove && isUp){
			params.onMove(e)
		}
		if(params.stop && isUp && isMoving){
			params.stop(e)
		}
		isMoving = false
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
		params.element.addEventListener("mousedown", onDown)
		params.element.addEventListener("touchstart", onDown)
	} else {
		params.element.addEventListener("mousedown", onDown)
		params.element.addEventListener("touchstart", onDown)
	}

	return () => {
		if(params.element instanceof HTMLElement){
			params.element.removeEventListener("mousedown", onDown)
			params.element.removeEventListener("touchstart", onDown)
		} else {
			params.element.removeEventListener("mousedown", onDown)
			params.element.removeEventListener("touchstart", onDown)
		}
	}
}