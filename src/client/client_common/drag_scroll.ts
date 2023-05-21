import {WBox} from "@nartallax/cardboard"
import {addMouseDragHandler, pointerEventsToClientCoords} from "client/client_common/mouse_drag"

type DragScrollProps = {
	element: HTMLElement
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
			evt.preventDefault()
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
				props.element.scrollLeft += dx * dragSpeed
				props.element.scrollTop += dy * dragSpeed
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