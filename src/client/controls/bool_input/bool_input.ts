import {WBox} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./bool_input.module.scss"

interface BoolInputProps {
	readonly value: WBox<boolean>
}

export const BoolInput = defineControl<BoolInputProps>(props => {
	const result = tag({
		class: [css.boolInput, {[css.on!]: props.value}],
		onClick: () => props.value(!props.value()),
		onKeydown: e => {
			if(e.key === "Enter" || e.key === "Space" || e.key === " "){
				props.value(!props.value())
			}
		}
	}, [
		tag({class: css.boolInputHandle})
	])

	result.tabIndex = 0

	return result
})