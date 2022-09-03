import {WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {NumberInput} from "client/controls/number_input/number_input"
import {GenParameterDefinition} from "common/common_types"

export function ParamLine(def: GenParameterDefinition, value: WBox<GenParameterDefinition["default"]>): HTMLElement {
	let input: HTMLElement
	switch(def.type){
		case "int":
		case "float":
			input = NumberInput({
				value: value as WBox<number>,
				int: def.type === "int",
				max: def.max,
				min: def.min,
				step: def.type === "int" ? def.step : undefined
			})
			break
		case "bool":
			input = BoolInput({
				value: value as WBox<boolean>
			})
			break
	}

	return tag({class: "param-line"}, [
		tag({
			class: "param-line-label",
			text: def.uiName
		}),
		input
	])
}