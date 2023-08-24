import {WBox} from "@nartallax/cardboard"
import {MouseDragHandlerParams, addMouseDragHandler, pointerEventsToClientCoords} from "client/client_common/mouse_drag"

type ElementDragScrollProps = {
	type: "element"
	draggedElement?: HTMLElement
}

type BoxDragScrollProps = {
	type: "box"
	x?: WBox<number>
	y?: WBox<number>
}

type DragScrollProps = (ElementDragScrollProps | BoxDragScrollProps) & {
	element: HTMLElement
	dragSpeed?: number
	isDragging?: WBox<boolean>
	onClick?: MouseDragHandlerParams["onClick"]
	distanceBeforeMove?: MouseDragHandlerParams["distanceBeforeMove"]
	constraintDirection?: MouseDragHandlerParams["constraintDirection"]
}

export function addDragScroll(props: DragScrollProps): void {
	let prevCoords: {x: number, y: number} | null = null
	const dragSpeed = props.dragSpeed ?? 1

	const changePosition = (dx: number, dy: number) => {
		if(props.type === "box"){
			props.x && props.x.set(props.x.get() + dx)
			props.y && props.y.set(props.y.get() + dy)
		} else {
			const el = props.draggedElement ?? props.element
			el.scrollLeft += dx
			el.scrollTop += dy
		}
	}

	addMouseDragHandler({
		element: props.element,
		distanceBeforeMove: props.distanceBeforeMove ?? 10,
		constraintDirection: props.constraintDirection,
		onClick: props.onClick,
		start: () => {
			props.isDragging && props.isDragging.set(true)
			return true
		},
		downIsMove: true,
		onMove: evt => {
			const coords = pointerEventsToClientCoords(evt)
			if(prevCoords){
				const dx = (prevCoords.x - coords.x) * dragSpeed
				const dy = (prevCoords.y - coords.y) * dragSpeed
				changePosition(dx, dy)
			}
			prevCoords = coords
		},
		stop: () => {
			prevCoords = null
			props.isDragging && props.isDragging.set(false)
		}
	})
}