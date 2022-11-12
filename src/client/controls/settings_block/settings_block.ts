import {MaybeRBoxed} from "client/base/box"
import {Taggable, tag} from "client/base/tag"

export function SettingsBlock(children: MaybeRBoxed<Taggable[]>): HTMLElement {
	return tag({class: "settings-block"}, children)
}