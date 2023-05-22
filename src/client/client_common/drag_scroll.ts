import {WBox} from "@nartallax/cardboard"
import {MouseDragHandlerParams, addMouseDragHandler, pointerEventsToClientCoords} from "client/client_common/mouse_drag"

type DragScrollProps = {
	element: HTMLElement
	draggedElement?: HTMLElement
	absPosScroll?: boolean
	dragSpeed?: number
	isDragging?: WBox<boolean>
	onClick?: MouseDragHandlerParams["onClick"]
	distanceBeforeMove?: MouseDragHandlerParams["distanceBeforeMove"]
	constraintDirection?: MouseDragHandlerParams["constraintDirection"]
}

export function addDragScroll(props: DragScrollProps): void {
	let prevCoords: {x: number, y: number} | null = null
	const dragSpeed = props.dragSpeed ?? 1

	addMouseDragHandler({
		element: props.element,
		distanceBeforeMove: props.distanceBeforeMove ?? 10,
		constraintDirection: props.constraintDirection,
		onClick: props.onClick,
		start: () => {
			props.isDragging && props.isDragging(true)
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
			}
			prevCoords = coords
		},
		stop: () => {
			prevCoords = null
			props.isDragging && props.isDragging(false)
		}
	})
}