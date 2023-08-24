import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./text_block.module.scss"
import {MRBox} from "@nartallax/cardboard"

type Props = {
	text: MRBox<string>
}

export const TextBlock = defineControl((props: Props) => {
	return tag({class: css.textBlock}, [props.text])
})