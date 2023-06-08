import {box, viewBox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {allKnownLoras, currentLoras} from "client/app/global_values"
import {BlockPanel} from "client/components/block_panel/block_panel"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {FormField} from "client/controls/form/form"
import {Form} from "client/controls/form/form"
import {NumberInput} from "client/controls/number_input/number_input"
import {Select} from "client/controls/select/select"

export const LoraSelectionPanel = () => {

	const emptySelectValue = {
		label: "Select LoRA...",
		value: null
	}

	const selectValue = box<string | null>(null)
	const loraByIdMap = allKnownLoras.map(loras => new Map(loras.map(lora => [lora.id, lora])))

	const result = tag({
		style: {
			display: allKnownLoras.map(loras => loras.length > 0 ? "" : "none")
		}
	}, [BlockPanel([
		BlockPanelHeader({header: "LoRAs"}),
		Select({
			value: selectValue,
			isArgumentInput: true,
			isSearchable: true,
			options: viewBox(() => {
				const selectedLoraIds = new Set(currentLoras().map(lora => lora.id))
				return [
					emptySelectValue,
					...allKnownLoras()
						.filter(lora => !selectedLoraIds.has(lora.id))
						.map(lora => ({label: lora.name, value: lora.id}))
				]
			})
		}),
		Form(currentLoras.mapArray(
			selectedLora => selectedLora.id,
			selectedLora => {
				const loraDef = loraByIdMap.map(map => map.get(selectedLora().id) ?? {
					id: selectedLora().id,
					name: selectedLora().id
				})
				return FormField({
					label: loraDef.prop("name"),
					maxLabelWidth: "11rem",
					input: NumberInput({
						precision: 2,
						value: selectedLora.prop("weight")
					}),
					hint: loraDef.map(lora => [
						lora.description,
						!lora.triggerWords ? "" : lora.triggerWords.join(", ")
					].filter(x => !!x).join("\n\n")),
					revertable: false,
					onDelete: () => {
						currentLoras(
							currentLoras()
								.filter(lora => lora.id !== selectedLora().id)
						)
					}
				})
			}))
	])])

	whileMounted(result, selectValue, value => {
		if(value === null){
			return
		}

		currentLoras([
			{id: value, weight: 1},
			...currentLoras()
		])

		selectValue(null)
	})

	return result
}