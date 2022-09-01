import {tag} from "client/base/tag"
import {ParamDefWithValue} from "client/client_types"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {NumberInput} from "client/controls/number_input/number_input"

export function ParamLine(opts: ParamDefWithValue): HTMLElement {
	let input: HTMLElement
	switch(opts.type){
		case "int":
		case "float":
			input = NumberInput({
				value: opts.value,
				int: opts.type === "int",
				max: opts.max,
				min: opts.min,
				step: opts.type === "int" ? opts.step : undefined
			})
			break
		case "bool":
			input = BoolInput({
				value: opts.value
			})
			break
	}

	return tag({class: "param-line"}, [
		tag({
			class: "param-line-label",
			text: opts.uiName
		}),
		input
	])
}