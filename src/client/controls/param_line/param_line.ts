import {MaybeRBoxed, viewBox, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {NumberInput} from "client/controls/number_input/number_input"
import {PictureInput} from "client/controls/picture_input/picture_input"
import {TextInput} from "client/controls/text_input/text_input"
import {TooltipIcon} from "client/controls/tooltip/tooltip"
import {GenParameterDefinition} from "common/common_types"
import {GenerationTaskParameterValue, PictureParameterValue} from "common/entity_types"

export function defaultValueOfParam(def: GenParameterDefinition): GenerationTaskParameterValue {
	switch(def.type){
		case "picture":
			return {id: 0}
		default: return def.default
	}
}

export function ParamLine(paramSetName: MaybeRBoxed<string>, def: GenParameterDefinition, value: WBox<GenerationTaskParameterValue>): HTMLElement {
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
		case "picture":
			input = PictureInput({
				paramSetName,
				value: value as WBox<PictureParameterValue>,
				param: def
			})
			break
	}

	return tag({tagName: "tr", class: "param-line"}, [
		tag({
			tagName: "td",
			class: "param-line-label",
			text: def.uiName
		}, [
			!def.tooltip ? null : TooltipIcon({tooltip: def.tooltip})
		]),
		tag({
			tagName: "td",
			class: ["param-line-revert-button", "icon-ccw", {
				hidden: viewBox(() => value() === defaultValueOfParam(def))
			}],
			on: {
				click: () => value(defaultValueOfParam(def))
			}
		}),
		tag({
			tagName: "td",
			class: "param-line-input-wrap"
		}, [input])
	])
}