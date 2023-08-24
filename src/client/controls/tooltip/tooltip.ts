import {tag} from "@nartallax/cardboard-dom"
import * as css from "./tooltip.module.scss"
import {makeOverlayItem} from "client/controls/overlay_item/overlay_item"
import {MRBox, box, constBoxWrap} from "@nartallax/cardboard"

interface TooltipIconProps {
	tooltip: HTMLElement | MRBox<string | undefined>
}

export const TooltipIcon = (props: TooltipIconProps): HTMLElement => {

	const overlayItemVisible = box(false)

	const tooltipIcon = tag({
		style: {
			// TODO: wtf, why props.tooltip is not RBox<string | undefined> here
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
		overlayPosition: "topLeft",
		canShiftVertically: true,
		zIndex: 200,
		parent: tooltipIcon
	})

	return tooltipIcon

}