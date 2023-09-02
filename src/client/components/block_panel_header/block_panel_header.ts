import {MRBox, WBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {BoolInput} from "client/controls/bool_input/bool_input"
import * as css from "./block_panel_header.module.scss"
import {Icon} from "client/generated/icons"

interface BlockPanelHeader {
	header: MRBox<string>
	toggle?: WBox<boolean>
	onClose?: () => void
}

export function BlockPanelHeader(props: BlockPanelHeader): HTMLElement {
	return tag({class: [css.settingsSubblockHeader, {[css.childrenVisible!]: !props.toggle ? true : props.toggle}]}, [
		tag({tag: "hr"}),
		tag({class: css.text}, [props.header]),
		!props.toggle ? null : BoolInput({value: props.toggle}),
		tag({tag: "hr"}),
		!props.onClose ? null : tag({
			tag: "button",
			class: [css.closeButton, Icon.cancel],
			onClick: props.onClose
		})
	])
}