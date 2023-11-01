import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./tooltip.module.scss"
import {makeOverlayItem} from "client/controls/overlay_item/overlay_item"
import {MRBox, box, constBoxWrap} from "@nartallax/cardboard"

interface TooltipIconProps {
	tooltip: HTMLElement | MRBox<string | undefined>
}

export const TooltipIcon = defineControl((props: TooltipIconProps) => {

	const hoveredElementCount = box(0)
	const overlayItemVisible = hoveredElementCount.map(count => count > 0)

	const tooltipIcon = tag({
		style: {
			display: constBoxWrap(props.tooltip).map(tt => !tt ? "none" : "")
		},
		class: css.tooltipIcon,
		onMouseenter: () => hoveredElementCount.set(hoveredElementCount.get() + 1),
		onMouseleave: () => hoveredElementCount.set(hoveredElementCount.get() - 1)
	}, ["?"])

	makeOverlayItem({
		referenceElement: tooltipIcon,
		body: tag({
			class: css.content,
			onMouseenter: () => hoveredElementCount.set(hoveredElementCount.get() + 1),
			onMouseleave: () => hoveredElementCount.set(hoveredElementCount.get() - 1)
		}, [props.tooltip]),
		visible: overlayItemVisible,
		referencePosition: "bottomRight",
		overlayPosition: "topLeft"
	})

	return tooltipIcon

})