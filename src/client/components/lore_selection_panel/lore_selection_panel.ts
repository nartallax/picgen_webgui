import {box, viewBox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {allKnownLores, currentLores} from "client/app/global_values"
import {BlockPanel} from "client/components/block_panel/block_panel"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {FormField} from "client/controls/form/form"
import {Form} from "client/controls/form/form"
import {NumberInput} from "client/controls/number_input/number_input"
import {Select} from "client/controls/select/select"

export const LoreSelectionPanel = () => {

	const emptySelectValue = {
		label: "Select lore...",
		value: null
	}

	const selectValue = box<string | null>(null)
	const loreByIdMap = allKnownLores.map(lores => new Map(lores.map(lore => [lore.id, lore])))

	const result = tag({
		style: {
			display: allKnownLores.map(lores => lores.length > 0 ? "" : "none")
		}
	}, [BlockPanel([
		BlockPanelHeader({header: "Lores"}),
		Select({
			value: selectValue,
			isArgumentInput: true,
			isSearchable: true,
			options: viewBox(() => {
				const selectedLoreIds = new Set(currentLores().map(lore => lore.id))
				return [
					emptySelectValue,
					...allKnownLores()
						.filter(lore => !selectedLoreIds.has(lore.id))
						.map(lore => ({label: lore.name, value: lore.id}))
				]
			})
		}),
		Form(currentLores.mapArray(
			selectedLore => selectedLore.id,
			selectedLore => {
				const loreDef = loreByIdMap.map(map => map.get(selectedLore().id) ?? {
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
						currentLores(
							currentLores()
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

		currentLores([
			{id: value, weight: 1},
			...currentLores()
		])

		selectValue(null)
	})

	return result
}