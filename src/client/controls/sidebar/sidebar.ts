import {defineControl, onMount, tag} from "@nartallax/cardboard-dom"
import * as css from "./sidebar.module.scss"
import {addMouseDragHandler, pointerEventsToClientCoords} from "client/client_common/mouse_drag"
import {WBox, box, viewBox} from "@nartallax/cardboard"

type Props = {
	isOpen?: WBox<boolean>
}

export const Sidebar = defineControl<Props>((props, children) => {
	const isOpen = props.isOpen ?? box(false)
	const isDragging = box(false)
	const dragProgress = box(0)

	const overlay = tag({
		class: css.sidebarOverlay,
		style: {
			opacity: viewBox(() => isDragging() ? dragProgress() : isOpen() ? 1 : 0),
			display: viewBox(() => isDragging() || isOpen() ? "" : "none")
		}
	})
	const wrap = tag({
		class: css.positioningWrap,
		style: {
			transform: viewBox(() => `translateX(${(isDragging() ? dragProgress() : isOpen() ? 1 : 0) * 100}%)`)
		}
	}, children)
	const result = tag({
		class: [css.sidebar]
	}, [overlay, wrap])

	let startX = 0

	function calcDragProgress(e: MouseEvent | TouchEvent): number {
		const curX = pointerEventsToClientCoords(e).x
		const diff = curX - startX
		let rate = diff / window.innerWidth

		if(isOpen()){
			rate = 1 + Math.max(-1, Math.min(0, rate))
		} else {
			rate = Math.max(0, Math.min(1, rate))
		}
		return rate
	}

	onMount(result, () => addMouseDragHandler({
		element: window,
		distanceBeforeMove: 25,
		constraintDirection: "horisontal",
		start: e => {
			// check if the mobile version is enabled
			if(getComputedStyle(result).position !== "absolute"){
				return false
			}
			isDragging(true)
			startX = pointerEventsToClientCoords(e).x
			return true
		},
		onMove: e => dragProgress(calcDragProgress(e)),
		stop: e => {
			const rate = calcDragProgress(e)
			if(isOpen() && rate < 0.75){
				isOpen(false)
			} else if(!isOpen() && rate > 0.25){
				isOpen(true)
			}
			isDragging(false)
		}
	}))

	return result
})