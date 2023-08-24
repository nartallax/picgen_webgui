import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./sidebar.module.scss"
import {WBox, box, calcBox} from "@nartallax/cardboard"

type Props = {
	isOpen?: WBox<boolean>
}

export const Sidebar = defineControl((props: Props, children) => {
	const isOpen = props.isOpen ?? box(false)
	const isDragging = box(false)
	const dragProgress = box(0)

	const overlay = tag({
		class: css.sidebarOverlay,
		style: {
			opacity: calcBox(
				[isDragging, dragProgress, isOpen],
				(isDragging, dragProgress, isOpen) => isDragging ? dragProgress : isOpen ? 1 : 0
			),
			display: calcBox([isDragging, isOpen], (isDragging, isOpen) => isDragging || isOpen ? "" : "none")
		}
	})
	const wrap = tag({
		class: css.positioningWrap,
		style: {
			transform: calcBox(
				[isDragging, dragProgress, isOpen],
				(isDragging, dragProgress, isOpen) => `translateX(${(isDragging ? dragProgress : isOpen ? 1 : 0) * 100}%)`
			)
		}
	}, children)
	const result = tag({
		class: [css.sidebar]
	}, [overlay, wrap])

	// TODO: remove this shit?
	// turns out it's a bad idea to add a handler to the window
	// because it fucks up a lot of native behaviours
	/*
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
	*/

	return result
})