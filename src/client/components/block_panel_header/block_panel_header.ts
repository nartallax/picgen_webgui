import {MRBox, RBox, WBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {BoolInput} from "client/controls/bool_input/bool_input"
import * as css from "./block_panel_header.module.scss"
import {Icon} from "client/generated/icons"
import {LockButton} from "client/controls/lock_button/lock_button"

interface BlockPanelHeader {
	header: MRBox<string>
	toggle?: WBox<boolean>
	onClose?: () => void
	isLocked?: RBox<boolean>
	onLockChange?: (isGroupChange: boolean) => void
}

export function BlockPanelHeader(props: BlockPanelHeader): HTMLElement {
	return tag({class: [css.settingsSubblockHeader, {[css.childrenVisible!]: !props.toggle ? true : props.toggle}]}, [
		tag({tag: "hr"}),
		!props.isLocked ? null : LockButton({isLocked: props.isLocked, onChange: props.onLockChange}),
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