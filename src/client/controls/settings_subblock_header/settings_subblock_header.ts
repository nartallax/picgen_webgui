import {MRBox, WBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {BoolInput} from "client/controls/bool_input/bool_input"

interface SettingsSubblockProps {
	header: MRBox<string>
	toggle?: WBox<boolean>
}

export function SettingsSubblockHeader(props: SettingsSubblockProps): HTMLElement {
	return tag({class: ["settings-subblock-header", {"children-visible": !props.toggle ? true : props.toggle}]}, [
		tag({tag: "hr"}),
		tag({class: "settings-subblock-header-text"}, [props.header]),
		!props.toggle ? null : BoolInput({value: props.toggle}),
		tag({tag: "hr"})
	])
}