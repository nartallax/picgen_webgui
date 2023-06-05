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
	const loraByIdMap = allKnownLoras.map(lores => new Map(lores.map(lore => [lore.id, lore])))

	const result = tag({
		style: {
			display: allKnownLoras.map(lores => lores.length > 0 ? "" : "none")
		}
	}, [BlockPanel([
		BlockPanelHeader({header: "LoRAs"}),
		Select({
			value: selectValue,
			isArgumentInput: true,
			isSearchable: true,
			options: viewBox(() => {
				const selectedLoreIds = new Set(currentLoras().map(lore => lore.id))
				return [
					emptySelectValue,
					...allKnownLoras()
						.filter(lora => !selectedLoreIds.has(lora.id))
						.map(lora => ({label: lora.name, value: lora.id}))
				]
			})
		}),
		Form(currentLoras.mapArray(
			selectedLore => selectedLore.id,
			selectedLore => {
				const loreDef = loraByIdMap.map(map => map.get(selectedLore().id) ?? {
					id: selectedLore().id,
					name: selectedLore().id
				})
				return FormField({
					label: loreDef.prop("name"),
					input: NumberInput({
						precision: 2,
						value: selectedLore.prop("weight")
					}),
					hint: loreDef.map(lore => !lore.triggerWords ? undefined : lore.triggerWords.join(", ")),
					revertable: false,
					onDelete: () => {
						currentLoras(
							currentLoras()
								.filter(lore => lore.id !== selectedLore().id)
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