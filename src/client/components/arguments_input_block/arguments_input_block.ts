import {MRBox, RBox, WBox, isWBox} from "@nartallax/cardboard"
import {bindBox, localStorageBox, tag} from "@nartallax/cardboard-dom"
import {BlockPanel} from "client/components/block_panel/block_panel"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {GenParameter, GenParameterGroup, GenerationParameterSet, defaultValueOfParam} from "common/entities/parameter"
import {NumberInput} from "client/controls/number_input/number_input"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {TextInput} from "client/controls/text_input/text_input"
import {PictureInput} from "client/components/picture_input/picture_input"
import {Select} from "client/controls/select/select"
import {FormField} from "client/controls/form/form"
import {GenerationTaskArgument, PictureArgument} from "common/entities/arguments"
import {JsonFileListInput} from "client/components/json_file_list_input/json_file_list_input"
import {JsonFileListArgument} from "common/entities/json_file_list"
import {argumentsByParamSet} from "client/app/global_values"
import {getGroupLockBoxes, getLockBox, makeGroupLockBox} from "client/controls/lock_button/lock_button"

interface ArgumentsInputBlockProps {
	readonly paramSet: RBox<GenerationParameterSet>
}

export function ArgumentsInputBlock(props: ArgumentsInputBlockProps): HTMLElement {
	const container = tag()

	bindBox(container, props.paramSet, paramSet => {
		const args = argumentsByParamSet.prop(paramSet.internalName)

		const blocks: HTMLElement[] = []
		const prompt = args.prop(paramSet.primaryParameter.jsonName) as WBox<string>

		for(const panelGroups of splitBySplitLines(paramSet.parameterGroups)){
			const panelChildren: HTMLElement[] = []
			for(const group of panelGroups){
				const defs = group.parameters

				const groupLockBoxes = getGroupLockBoxes(paramSet, group)
				const groupLockBox = !group.toggle?.jsonName
					? makeGroupLockBox(groupLockBoxes)
					: getLockBox(paramSet, group.toggle.jsonName)
				const groupToggle = !group.toggle
					? undefined
					: typeof(group.toggle.jsonName) !== "string"
						? localStorageBox<boolean>(container, "namelessGroupToggle." + paramSet.internalName + "." + group.uiName, group.toggle.default)
						: args.prop(group.toggle.jsonName) as WBox<boolean>
				if(group.toggle && !groupToggle){
					continue
				}
				panelChildren.push(BlockPanelHeader({
					header: group.uiName,
					toggle: groupToggle,
					isLocked: groupLockBox,
					onLockChange: isGroupChange => {
						if(isGroupChange || !isWBox(groupLockBox)){
							const shouldBeLocked = !!groupLockBoxes.find(x => !x.get())
							for(const lock of groupLockBoxes){
								lock.set(shouldBeLocked)
							}
						} else if(isWBox(groupLockBox)){
							groupLockBox.set(!groupLockBox.get())
						}
					}
				}))

				for(const def of defs){
					const valueBox = args.prop(def.jsonName)
					panelChildren.push(ArgumentField({def, value: valueBox, visible: groupToggle, paramSet, prompt}))
				}
			}
			blocks.push(BlockPanel(panelChildren))
		}

		container.replaceChildren(...blocks)
	})

	return container
}


type ArgumentFieldProps = {
	def: GenParameter
	value: WBox<GenerationTaskArgument>
	visible?: MRBox<boolean>
	paramSet: GenerationParameterSet
	prompt: WBox<string>
}

function ArgumentField(props: ArgumentFieldProps): HTMLElement {
	const lockBox = getLockBox(props.paramSet, props.def.jsonName)

	if(props.def.type === "json_file_list"){
		return JsonFileListInput({
			isLocked: lockBox,
			def: props.def,
			value: props.value as WBox<JsonFileListArgument[]>,
			prompt: props.prompt
		})
	} else {
		return FormField({
			isLocked: lockBox,
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