import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./tooltip.module.scss"

interface TooltipIconProps {
	tooltip: string
}

export const TooltipIcon = defineControl<TooltipIconProps>(props => {

	return tag({
		class: css.tooltipIcon
	}, [
		"?",
		tag({
			class: css.content
		}, [props.tooltip])
	])

})