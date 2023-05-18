import {MRBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import * as css from "./block_panel.module.scss"

export function BlockPanel(children: MRBox<HTMLElement[]>): HTMLElement {
	return tag({class: css.blockPanel}, children)
}