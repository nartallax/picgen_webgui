import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./block_panel.module.scss"

export const BlockPanel = defineControl((_: unknown, children) => {
	return tag({class: css.blockPanel}, children)
})