import {defineControl, tag} from "@nartallax/cardboard-dom"

interface TooltipIconProps {
	tooltip: string
}

export const TooltipIcon = defineControl<TooltipIconProps>(props => {

	return tag({
		class: "tooltip-icon"
	}, [
		"?",
		tag({class: "tooltip-content-wrap"}, [
			tag({
				class: "tooltip-content"
			}, [props.tooltip])
		])
	])

})