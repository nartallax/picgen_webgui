import {WBox} from "@nartallax/cardboard"
import {IconButton} from "client/controls/icon_button/icon_button"
import {Icon} from "client/generated/icons"
import * as css from "./main_menu.module.scss"

interface Props {
	readonly isOpen: WBox<boolean>
}

export const MainMenuButton = (props: Props) => IconButton({
	icon: Icon.menu,
	onClick: () => props.isOpen.set(!props.isOpen.get()),
	class: css.mainMenuButton
})