import {ControlOptions} from "client/base/control"
import {HtmlTaggable, tag} from "client/base/tag"

interface SettingsSubblockOptions {
	header: string
}

export function SettingsSubblock(opts: ControlOptions<SettingsSubblockOptions>, children?: HtmlTaggable[]): HTMLElement {
	return tag({class: "settings-subblock"}, [
		tag({class: "settings-subblock-header"}, [
			tag({tagName: "hr"}),
			tag({class: "settings-subblock-header-text", text: opts.header}),
			tag({tagName: "hr"})
		]),
		...(children || [])
	])

}