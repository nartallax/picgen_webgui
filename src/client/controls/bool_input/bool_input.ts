import {WBox} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"

interface BoolInputProps {
	readonly value: WBox<boolean>
}

export const BoolInput = defineControl<BoolInputProps>(props => {
	const result = tag({
		class: ["input bool-input", {on: props.value}],
		onClick: () => props.value(!props.value()),
		onKeydown: e => {
			if(e.key === "Enter" || e.key === "Space" || e.key === " "){
				props.value(!props.value())
			}
		}
	}, [
		tag({class: "bool-input-handle"})
	])

	result.tabIndex = 0

	return result
})