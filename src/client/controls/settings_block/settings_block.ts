import {MaybeRBoxed} from "client/base/box"
import {HtmlTaggable, tag} from "client/base/tag"

export function SettingsBlock(children: MaybeRBoxed<HtmlTaggable[]>): HTMLElement {
	return tag({class: "settings-block"}, children)
}