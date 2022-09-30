import {viewBox, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {NumberInput} from "client/controls/number_input/number_input"
import {TextInput} from "client/controls/text_input/text_input"
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
		case "string":
			input = TextInput({
				value: value as WBox<string>,
				maxLength: def.maxLength,
				minLength: def.minLength
			})
			break
	}

	return tag({tagName: "tr", class: "param-line"}, [
		tag({
			tagName: "td",
			class: "param-line-label",
			text: def.uiName
		}),
		tag({
			tagName: "td",
			class: ["param-line-revert-button", "icon-ccw", {
				hidden: viewBox(() => value() === def.default)
			}],
			on: {
				click: () => value(def.default)
			}
		}),
		tag({
			tagName: "td",
			class: "param-line-input-wrap"
		}, [input])
	])
}