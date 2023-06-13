import {box, viewBox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {allKnownLoras, currentLoras, loraOrdering} from "client/app/global_values"
import {BlockPanel} from "client/components/block_panel/block_panel"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {showLoraOrderListModal} from "client/components/lora_selection_panel/lora_order_list"
import {Button} from "client/controls/button/button"
import {FormField} from "client/controls/form/form"
import {Row} from "client/controls/layout/row_col"
import {NumberInput} from "client/controls/number_input/number_input"
import {Select} from "client/controls/select/select"

export const LoraSelectionPanel = () => {

	const emptySelectValue = {
		label: "Select LoRA...",
		value: null
	}

	const selectValue = box<string | null>(null)
	const loraByIdMap = allKnownLoras.map(loras => new Map(loras.map(lora => [lora.id, lora])))
	const loraOptions = allKnownLoras.map(allKnownLoras => allKnownLoras.map(lora => ({label: lora.name, value: lora.id})))

	const result = tag({
		style: {
			display: allKnownLoras.map(loras => loras.length > 0 ? "" : "none")
		}
	}, [BlockPanel([
		BlockPanelHeader({header: "LoRAs"}),
		Row({gap: true}, [
			Select({
				value: selectValue,
				isArgumentInput: true,
				isSearchable: true,
				options: viewBox(() => {
					const allKnownLoraIds = new Set(allKnownLoras().map(lora => lora.id))
					const selectedLoraIds = new Set(currentLoras().map(lora => lora.id))
					const orderedLoraIds = loraOrdering().filter(id => !selectedLoraIds.has(id) && allKnownLoraIds.has(id))
					const orderedLoraIdsSet = new Set(orderedLoraIds)
					const unorderedLoraIds = allKnownLoras()
						.filter(lora => !selectedLoraIds.has(lora.id) && !orderedLoraIdsSet.has(lora.id))
						.map(lora => lora.id)
						.sort()

					const loraOptionsMap = new Map(
						loraOptions().map(option => [option.value, option])
					)

					return [
						emptySelectValue,
						...[...orderedLoraIds, ...unorderedLoraIds].map(id => {
							const opt = loraOptionsMap.get(id)
							if(!opt){
								throw new Error("No option for id " + id)
							}
							return opt
						})
					]
				})
			}),
			Button({
				iconClass: "icon-cog",
				onclick: () => {
					showLoraOrderListModal()
				}
			})
		]),
		tag(currentLoras.mapArray(
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