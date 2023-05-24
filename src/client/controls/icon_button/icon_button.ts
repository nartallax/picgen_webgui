import {tag} from "@nartallax/cardboard-dom"
import * as css from "./icon_button.module.scss"

type Props = {
	icon: string
	onClick?: () => void
	class?: string
}

export const IconButton = (props: Props) => {
	return tag({
		tag: "button",
		class: [css.iconButton, props.icon, props.class],
		onClick: props.onClick
	})
}