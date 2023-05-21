import {WBox} from "@nartallax/cardboard"
import {addMouseDragHandler, pointerEventsToClientCoords} from "client/client_common/mouse_drag"

type DragScrollProps = {
	element: HTMLElement
	draggedElement?: HTMLElement
	absPosScroll?: boolean
	dragSpeed?: number
	isDragging?: WBox<boolean>
	onClick?: (e: MouseEvent | TouchEvent) => void
	clickDistance?: number
}

export function addDragScroll(props: DragScrollProps): void {
	let distanceApprox = 0
	let prevCoords: {x: number, y: number} | null = null
	const dragSpeed = props.dragSpeed ?? 1
	const clickDistance = props.clickDistance ?? 10

	let isClickingNow = false

	addMouseDragHandler({
		element: props.element,
		start: evt => {
			if(evt.cancelable !== false){
				evt.preventDefault()
			}
			evt.stopPropagation()
			props.isDragging && props.isDragging(true)
			distanceApprox = 0
			return true
		},
		downIsMove: true,
		onMove: evt => {
			const coords = pointerEventsToClientCoords(evt)
			if(prevCoords){
				const dx = prevCoords.x - coords.x
				const dy = prevCoords.y - coords.y
				const el = props.draggedElement ?? props.element
				if(props.absPosScroll){
					el.style.left = (parseFloat(el.style.left || "0") - (dx * dragSpeed)) + "px"
					el.style.top = (parseFloat(el.style.top || "0") - (dy * dragSpeed)) + "px"
				} else {
					el.scrollLeft += dx * dragSpeed
					el.scrollTop += dy * dragSpeed
				}
				distanceApprox += Math.abs(dx) + Math.abs(dy)
			}
			prevCoords = coords
		},
		stop: e => {
			prevCoords = null
			if(distanceApprox < clickDistance){
				if(props.onClick){
					props.onClick(e)
				}

				isClickingNow = true
				try {
					if(e.target instanceof HTMLElement){
						e.target.click()
					}
				} finally {
					isClickingNow = false
				}
			}
			distanceApprox = 0
			props.isDragging && props.isDragging(false)
		}
	})

	props.element.addEventListener("click", e => {
		if(!isClickingNow){
			e.stopPropagation()
		}
	}, {capture: true})
}