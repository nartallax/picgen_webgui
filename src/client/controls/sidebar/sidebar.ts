import {defineControl, onMount, tag} from "@nartallax/cardboard-dom"
import * as css from "./sidebar.module.scss"
import {addMouseDragHandler, pointerEventsToClientCoords} from "client/client_common/mouse_drag"

export const Sidebar = defineControl((_, children) => {
	const overlay = tag({class: css.sidebarOverlay})
	const wrap = tag({class: css.positioningWrap}, children)
	const result = tag({class: [css.sidebar]}, [wrap])

	let startX = 0
	let width = 0
	let isOpen = false

	function calcRate(e: MouseEvent | TouchEvent): number {
		const curX = pointerEventsToClientCoords(e).x
		const diff = curX - startX
		let result = Math.max(-1, Math.min(1, diff / width))
		if(isOpen){
			result = 1 + result
		}
		return result
	}

	onMount(result, () => addMouseDragHandler({
		element: window,
		start: e => {
			if(getComputedStyle(result).position !== "absolute"){
				return false
			}
			result.before(overlay)
			startX = pointerEventsToClientCoords(e).x
			width = wrap.clientWidth
			return true
		},
		onMove: e => {
			const rate = calcRate(e)
			result.style.transform = `translateX(${rate * width}px)`
			overlay.style.opacity = rate + ""
		},
		stop: e => {
			const rate = calcRate(e)
			if(isOpen && rate < 0.75){
				isOpen = false
			} else if(!isOpen && rate > 0.25){
				isOpen = true
			}

			if(!isOpen){
				overlay.remove()
			}

			result.style.transform = `translateX(${isOpen ? width : 0}px)`
			overlay.style.opacity = (isOpen ? 1 : 0) + ""
		}
	}))

	return result
})