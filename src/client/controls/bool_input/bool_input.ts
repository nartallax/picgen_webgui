import {WBox} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./bool_input.module.scss"

interface BoolInputProps {
	readonly value: WBox<boolean>
}

export const BoolInput = defineControl((props: BoolInputProps) => {
	const result = tag({
		class: [css.boolInput, {[css.on!]: props.value}],
		onClick: () => props.value.set(!props.value.get()),
		onKeydown: e => {
			if(e.key === "Enter" || e.key === "Space" || e.key === " "){
				props.value.set(!props.value.get())
			}
		}
	}, [
		tag({class: css.boolInputHandle})
	])

	result.tabIndex = 0

	return result
})