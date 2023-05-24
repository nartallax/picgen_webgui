import {MRBox, RBox, WBox, box, unbox} from "@nartallax/cardboard"
import {whileMounted} from "@nartallax/cardboard-dom"
import {BlockPanel} from "client/components/block_panel/block_panel"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {GenParameter, GenParameterGroup, defaultValueOfParam} from "common/entities/parameter"
import {currentArgumentBoxes} from "client/app/global_values"
import {GenerationTaskArgument} from "common/entities/generation_task"
import {NumberInput} from "client/controls/number_input/number_input"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {TextInput} from "client/controls/text_input/text_input"
import {PictureInput} from "client/components/picture_input/picture_input"
import {Select} from "client/controls/select/select"
import {PictureArgument} from "common/entities/picture"
import {Form, FormField, FormHeader} from "client/controls/form/form"

interface ArgumentsInputBlock {
	readonly paramGroups: RBox<null | readonly GenParameterGroup[]>
}

export function ParamsBlock(props: ArgumentsInputBlock): HTMLElement {

	const contentItems = box([] as HTMLElement[])

	function renderItems(): HTMLElement[] {
		const groups = unbox(props.paramGroups)

		if(!groups){
			return [BlockPanelHeader({header: "Loading..."})]
		}

		const lines: HTMLElement[] = []

		for(const group of groups){
			const defs = group.parameters

			const groupToggle = !group.toggle ? undefined : (currentArgumentBoxes[group.toggle.jsonName] as WBox<boolean>)
			lines.push(FormHeader({header: group.uiName, toggle: groupToggle}))

			for(const def of defs){
				const value = currentArgumentBoxes[def.jsonName]
				if(!value){
					console.error("No value is defined for parameter " + def.jsonName)
					continue
				}
				lines.push(ArgumentField({def, value, visible: groupToggle}))
			}

		}

		return [Form(lines)]
	}

	const result = BlockPanel(contentItems)

	whileMounted(result, props.paramGroups, () => contentItems(renderItems()))

	return result
}


type ArgumentFieldProps = {
	def: GenParameter
	value: WBox<GenerationTaskArgument>
	visible?: MRBox<boolean>
}

function ArgumentField(props: ArgumentFieldProps): HTMLElement {
	return FormField({
		label: props.def.uiName,
		hint: props.def.tooltip,
		input: ArgumentInput(props.def, props.value),
		visible: props.visible,
		revertable: props.value.map(value => {
			if(props.def.type === "picture"){
				return (value as PictureArgument).id !== 0
			}
			return value !== defaultValueOfParam(props.def)
		}),
		onRevert: () => props.value(defaultValueOfParam(props.def))
	})
}

function ArgumentInput(def: GenParameter, value: WBox<GenerationTaskArgument>): HTMLElement {
	switch(def.type){
		case "int":
		case "float":
			return NumberInput({
				value: value as WBox<number>,
				int: def.type === "int",
				max: def.max,
				min: def.min,
				step: def.type === "int" ? def.step : undefined
			})
		case "bool":
			return BoolInput({value: value as WBox<boolean>})
		case "string":
			return TextInput({
				value: value as WBox<string>,
				maxLength: def.maxLength,
				minLength: def.minLength
			})
		case "picture":
			return PictureInput({
				value: value as WBox<PictureArgument>,
				param: def
			})
		case "enum":
			return Select({
				value: value as WBox<string | number>,
				isArgumentInput: true,
				options: def.options.map(opt => {
					if(typeof(opt) === "string" || typeof(opt) === "number"){
						return {label: opt + "", value: opt}
					} else {
						return opt
					}
				})
			})
	}
}