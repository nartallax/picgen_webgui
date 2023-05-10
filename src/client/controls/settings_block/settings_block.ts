import {MRBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import * as css from "./settings_block.module.scss"

export function SettingsBlock(children: MRBox<HTMLElement[]>): HTMLElement {
	return tag({class: css.settingsBlock}, children)
}