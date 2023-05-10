import {WBox, viewBox} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {NumberInput} from "client/controls/number_input/number_input"
import {PictureInput} from "client/controls/picture_input/picture_input"
import {TextInput} from "client/controls/text_input/text_input"
import {TooltipIcon} from "client/controls/tooltip/tooltip"
import {GenParameterDefinition, GenParameterGroupToggle} from "common/common_types"
import {GenerationTaskParameterValue, PictureParameterValue} from "common/entity_types"

export function defaultValueOfParam(def: GenParameterDefinition | GenParameterGroupToggle): GenerationTaskParameterValue {
	if(!("type" in def)){
		return def.default
	}

	switch(def.type){
		case "picture":
			return {id: 0}
		default: return def.default
	}
}

interface ParamLineProps {
	paramSetName: string
	def: GenParameterDefinition
	value: WBox<GenerationTaskParameterValue>
	visible?: boolean
}

const defaults = {
	visible: true
} satisfies Partial<ParamLineProps>

export const ParamLine = defineControl<ParamLineProps, typeof defaults>(defaults, props => {
	let input: HTMLElement
	const def = props.def()
	switch(def.type){
		case "int":
		case "float":
			input = NumberInput({
				value: props.value as WBox<number>,
				int: def.type === "int",
				max: def.max,
				min: def.min,
				step: def.type === "int" ? def.step : undefined
			})
			break
		case "bool":
			input = BoolInput({
				value: props.value as WBox<boolean>
			})
			break
		case "string":
			input = TextInput({
				value: props.value as WBox<string>,
				maxLength: def.maxLength,
				minLength: def.minLength
			})
			break
		case "picture":
			input = PictureInput({
				paramSetName: props.paramSetName,
				value: props.value as WBox<PictureParameterValue>,
				param: def
			})
			break
	}

	const display = props.visible.map(visible => visible ? "" : "none")

	return tag({tag: "tr", class: "param-line", style: {display}}, [
		tag({
			tag: "td",
			class: "param-line-label"
		}, [
			def.uiName,
			!def.tooltip ? null : TooltipIcon({tooltip: def.tooltip})
		]),
		tag({
			tag: "td",
			class: ["param-line-revert-button", "icon-ccw", {
				hidden: viewBox(() => {
					if(def.type === "picture"){
						return (props.value() as PictureParameterValue).id === 0
					}
					return props.value() === defaultValueOfParam(def)
				})
			}],
			onClick: () => props.value(defaultValueOfParam(def))
		}),
		tag({
			tag: "td",
			class: "param-line-input-wrap"
		}, [input])
	])
})