import {ControlOptions} from "client/base/control"
import {tag} from "client/base/tag"

interface SettingsSubblockOptions {
	header: string
}

export function SettingsSubblockHeader(opts: ControlOptions<SettingsSubblockOptions>): HTMLElement {
	return tag({class: "settings-subblock-header"}, [
		tag({tagName: "hr"}),
		tag({class: "settings-subblock-header-text", text: opts.header}),
		tag({tagName: "hr"})
	])
}