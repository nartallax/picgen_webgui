import {MRBox, RBox, WBox, calcBox} from "@nartallax/cardboard"
import {bindBox, localStorageBox, tag} from "@nartallax/cardboard-dom"
import {BlockPanel} from "client/components/block_panel/block_panel"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {GenParameter, GenParameterGroup, GenerationParameterSet, defaultValueOfParam} from "common/entities/parameter"
import {currentArgumentBoxes} from "client/app/global_values"
import {NumberInput} from "client/controls/number_input/number_input"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {TextInput} from "client/controls/text_input/text_input"
import {PictureInput} from "client/components/picture_input/picture_input"
import {Select} from "client/controls/select/select"
import {FormField} from "client/controls/form/form"
import {GenerationTaskArgument, PictureArgument} from "common/entities/arguments"
import {JsonFileListInput} from "client/components/json_file_list_input/json_file_list_input"
import {JsonFileListArgument} from "common/entities/json_file_list"

interface ArgumentsInputBlockProps {
	readonly paramSet: RBox<GenerationParameterSet>
}

export function ArgumentsInputBlock(props: ArgumentsInputBlockProps): HTMLElement {
	const container = tag()

	const childBox = calcBox([props.paramSet, currentArgumentBoxes], (paramSet, boxMap) => {
		const groups = paramSet.parameterGroups

		if(!groups){
			return [BlockPanelHeader({header: "Loading..."})]
		}

		const result: HTMLElement[] = []
		for(const panelGroups of splitBySplitLines(groups)){
			const panelChildren: HTMLElement[] = []
			for(const group of panelGroups){
				const defs = group.parameters

				const groupToggle = !group.toggle
					? undefined
					: typeof(group.toggle.jsonName) !== "string"
						? localStorageBox<boolean>(container, "namelessGroupToggle." + paramSet.internalName + "." + group.uiName, group.toggle.default)
						: (boxMap[group.toggle.jsonName] as WBox<boolean> | undefined)
				if(group.toggle && !groupToggle){
					continue
				}
				panelChildren.push(BlockPanelHeader({header: group.uiName, toggle: groupToggle}))

				for(const def of defs){
					const value = boxMap[def.jsonName]
					if(!value){
						// can happen if boxMap is just loading
						continue
					}
					panelChildren.push(ArgumentField({def, value, visible: groupToggle, paramSet}))
				}
			}
			result.push(BlockPanel(panelChildren))
		}
		return result
	})

	// TODO: another case of one-box container
	// in this case, TWO-box container. hnnng.
	bindBox(container, childBox, children => container.replaceChildren(...children))

	return container
}


type ArgumentFieldProps = {
	def: GenParameter
	value: WBox<GenerationTaskArgument>
	visible?: MRBox<boolean>
	paramSet: GenerationParameterSet
}

function ArgumentField(props: ArgumentFieldProps): HTMLElement {
	if(props.def.type === "json_file_list"){
		return JsonFileListInput({
			def: props.def,
			value: props.value as WBox<JsonFileListArgument[]>
		})
	} else {
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
			onRevert: () => props.value.set(defaultValueOfParam(props.def)),
			isInputOnNextLine: props.def.type === "string" && props.def.large
		})
	}
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
				minLength: def.minLength,
				lineCount: def.large ? 4 : undefined
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
				isSearchable: def.searchable,
				options: def.options.map(opt => {
					if(typeof(opt) === "string" || typeof(opt) === "number"){
						return {label: opt + "", value: opt}
					} else {
						return opt
					}
				})
			})
		case "json_file_list":
			throw new Error("Should have been processed in parent component")

	}
}

function splitBySplitLines(groups: readonly GenParameterGroup[]): GenParameterGroup[][] {
	const result: GenParameterGroup[][] = []
	let currentGroup: GenParameterGroup[] = []

	for(const group of groups){
		if(group.split){
			if(currentGroup.length > 0){
				result.push(currentGroup)
			}
			currentGroup = []
		}
		currentGroup.push(group)
	}

	if(currentGroup.length > 0){
		result.push(currentGroup)
	}

	return result
}