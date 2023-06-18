import {WBox, box, viewBox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {allKnownJsonFileLists, jsonFileListOrdering} from "client/app/global_values"
import {showJsonFileListOrderModal} from "client/components/json_file_list_input/json_file_list_ordering"
import {Button} from "client/controls/button/button"
import {FormField} from "client/controls/form/form"
import {Row} from "client/controls/layout/row_col"
import {NumberInput} from "client/controls/number_input/number_input"
import {Select} from "client/controls/select/select"
import {JsonFileListArgument} from "common/entities/json_file_list"
import {JsonFileListGenParam} from "common/entities/parameter"

type Props = {
	def: JsonFileListGenParam
	value: WBox<JsonFileListArgument[]>
}

export const JsonFileListInput = (props: Props) => {

	const listName = props.def.directory

	const emptySelectValue = {
		label: props.def.inputInvitation ?? "Select item...",
		value: null
	}

	const allItems = allKnownJsonFileLists
		.prop(listName)
		.map(items => items ?? [])

	const selectValue = box<string | null>(null)
	const defByIdMap = allItems.map(items => new Map(items.map(item => [item.id, item])))
	const options = allItems.map(allItem => allItem.map(item => ({label: item.name, value: item.id})))

	const result = tag([
		Row({gap: true}, [
			Select({
				value: selectValue,
				isArgumentInput: true,
				isSearchable: true,
				options: viewBox(() => {
					const allKnownIds = new Set(allItems().map(item => item.id))
					const selectedIds = new Set(props.value().map(item => item.id))
					const ordering = jsonFileListOrdering()[listName] ?? []
					const orderedIds = ordering.filter(id => !selectedIds.has(id) && allKnownIds.has(id))
					const orderedIdSet = new Set(orderedIds)
					const unorderedIds = allItems()
						.filter(item => !selectedIds.has(item.id) && !orderedIdSet.has(item.id))
						.map(item => item.id)
						.sort()

					const optionsMap = new Map(
						options().map(option => [option.value, option])
					)

					return [
						emptySelectValue,
						...[...orderedIds, ...unorderedIds].map(id => {
							const opt = optionsMap.get(id)
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
					showJsonFileListOrderModal(props)
				}
			})
		]),
		tag(props.value.mapArray(
			selectedItem => selectedItem.id,
			selectedItem => {
				const itemDef = defByIdMap.map(map => map.get(selectedItem().id) ?? {
					id: selectedItem().id,
					name: selectedItem().id
				})
				return FormField({
					label: itemDef.prop("name"),
					maxLabelWidth: "11rem",
					input: NumberInput({
						precision: 2,
						value: selectedItem.prop("weight")
					}),
					hint: itemDef.map(item => [
						item.description,
						!item.triggerWords ? "" : item.triggerWords.join(", ")
					].filter(x => !!x).join("\n\n")),
					revertable: false,
					onDelete: () => {
						props.value(props.value().filter(item => item.id !== selectedItem().id))
					}
				})
			}))
	])

	whileMounted(result, selectValue, value => {
		if(value === null){
			return
		}

		props.value([{id: value, weight: 1}, ...props.value()])

		selectValue(null)
	})

	return result
}