import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./tooltip.module.scss"

interface TooltipIconProps {
	tooltip: string
}

export const TooltipIcon = defineControl<TooltipIconProps>(props => {

	const posPadding = tag({class: css.positioningPadding})

	const contentWrap = tag({
		class: css.contentPositionWrap
	}, [
		posPadding,
		tag({
			class: css.content
		}, [props.tooltip])
	])

	const tooltipIcon = tag({
		class: css.tooltipIcon,
		onMouseover: () => {
			const rect = tooltipIcon.getBoundingClientRect()
			console.log(rect.top)
			contentWrap.style.top = -rect.top + "px"
			posPadding.style.height = rect.top + "px"
			console.log(posPadding.style.height)
		}
	}, ["?", contentWrap])

	return tooltipIcon

})