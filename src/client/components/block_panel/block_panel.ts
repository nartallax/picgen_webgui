import {tag} from "@nartallax/cardboard-dom"
import * as css from "./block_panel.module.scss"

// TODO: control?
export function BlockPanel(children: HTMLElement[]): HTMLElement {
	return tag({class: css.blockPanel}, children)
}