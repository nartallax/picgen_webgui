import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./tooltip.module.scss"
import {makeOverlayItem} from "client/controls/overlay_item/overlay_item"
import {MRBox, box, constBoxWrap} from "@nartallax/cardboard"

interface TooltipIconProps {
	tooltip: HTMLElement | MRBox<string | undefined>
}

export const TooltipIcon = defineControl((props: TooltipIconProps) => {

	const overlayItemVisible = box(false)

	const tooltipIcon = tag({
		style: {
			display: constBoxWrap(props.tooltip).map(tt => !tt ? "none" : "")
		},
		class: css.tooltipIcon,
		onMouseenter: () => overlayItemVisible.set(true),
		onMouseleave: () => overlayItemVisible.set(false)
	}, ["?"])

	makeOverlayItem({
		referenceElement: tooltipIcon,
		body: tag({class: css.content}, [props.tooltip]),
		visible: overlayItemVisible,
		referencePosition: "bottomRight",
		overlayPosition: "topLeft"
	})

	return tooltipIcon

})