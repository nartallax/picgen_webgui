import {MRBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"

export function SettingsBlock(children: MRBox<HTMLElement[]>): HTMLElement {
	return tag({class: "settings-block"}, children)
}