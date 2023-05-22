type Props = {
	readonly target: HTMLElement
	readonly getZoom: () => number
	readonly setZoom: (newZoom: number, centerCoords: {x: number, y: number}) => void
	readonly multiplier?: number
}

export function addTouchZoom(props: Props): void {

	let isEngaged = false
	let initialDistance = 0
	let initialZoom = 0
	const mult = props.multiplier ?? 1

	function calcDistanceBetweenTouches(e: TouchEvent): number | null {
		const a = e.touches[0]
		const b = e.touches[1]
		if(!a || !b){
			return null
		}
		return Math.sqrt((a.clientX - b.clientX) ** 2 + (a.clientY - b.clientY) ** 2) * mult
	}

	function calcCenterCoords(e: TouchEvent): {x: number, y: number} | null {
		const a = e.touches[0]
		const b = e.touches[1]
		if(!a || !b){
			return null
		}
		return {
			x: (a.clientX + b.clientX) / 2,
			y: (a.clientY + b.clientY) / 2
		}
	}

	const onMove = (e: TouchEvent) => {
		const currentDistance = calcDistanceBetweenTouches(e)
		const centerCoords = calcCenterCoords(e)
		if(currentDistance === null || !centerCoords){
			return
		}
		const rate = currentDistance / initialDistance
		const newZoom = initialZoom * rate
		props.setZoom(newZoom, centerCoords)
	}

	const onUp = () => {
		if(isEngaged){
			window.removeEventListener("touchmove", onMove)
			window.removeEventListener("touchend", onUp)
		}
		isEngaged = false
	}

	const onDown = (e: TouchEvent) => {
		const dist = calcDistanceBetweenTouches(e)
		if(e.touches.length !== 2 || dist === null){
			if(isEngaged){
				onUp()
			}
			return
		}

		isEngaged = true
		initialDistance = dist
		initialZoom = props.getZoom()
		window.addEventListener("touchmove", onMove, {passive: true})
		window.addEventListener("touchend", onUp)
	}

	props.target.addEventListener("touchstart", onDown, {passive: true})

}