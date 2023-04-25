import {MaybeRBoxed, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {BoolInput} from "client/controls/bool_input/bool_input"

interface SettingsSubblockOptions {
	header: MaybeRBoxed<string>
	toggle?: WBox<boolean>
}

export function SettingsSubblockHeader(opts: SettingsSubblockOptions): HTMLElement {
	return tag({class: ["settings-subblock-header", {"children-visible": !opts.toggle ? true : opts.toggle}]}, [
		tag({tagName: "hr"}),
		tag({class: "settings-subblock-header-text", text: opts.header}),
		!opts.toggle ? null : BoolInput({value: opts.toggle}),
		tag({tagName: "hr"})
	])
}