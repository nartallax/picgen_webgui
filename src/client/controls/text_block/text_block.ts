import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./text_block.module.scss"

type Props = {
	text: string
}

export const TextBlock = defineControl<Props>(props => {
	return tag({class: css.textBlock}, [props.text])
})