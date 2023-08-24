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

	return result
})