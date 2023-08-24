import {WBox, box, calcBox} from "@nartallax/cardboard"
import {bindBox, tag} from "@nartallax/cardboard-dom"
import {allKnownJsonFileLists, currentPrompt, jsonFileListOrdering} from "client/app/global_values"
import {showJsonFileListOrderModal} from "client/components/json_file_list_input/json_file_list_ordering"
import {Button} from "client/controls/button/button"
import {FormField} from "client/controls/form/form"
import {Row} from "client/controls/layout/row_col"
import {NumberInput} from "client/controls/number_input/number_input"
import {Select} from "client/controls/select/select"
import {JsonFileListArgument} from "common/entities/json_file_list"
import {JsonFileListGenParam} from "common/entities/parameter"
import * as css from "./json_file_list_input.module.scss"

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
	const orderingBox: WBox<string[] | undefined> = jsonFileListOrdering.prop(listName)

	const result = tag([
		Row({gap: true}, [
			Select({
				value: selectValue,
				isArgumentInput: true,
				isSearchable: true,
				options: calcBox([allItems, orderingBox, props.value, options], (allItems, ordering, value, options) => {
					const allKnownIds = new Set(allItems.map(item => item.id))
					const selectedIds = new Set(value.map(item => item.id))
					ordering = ordering ?? []
					const orderedIds = ordering.filter(id => !selectedIds.has(id) && allKnownIds.has(id))
					const orderedIdSet = new Set(orderedIds)
					const unorderedIds = allItems
						.filter(item => !selectedIds.has(item.id) && !orderedIdSet.has(item.id))
						.map(item => item.id)
						.sort()

					const optionsMap = new Map(
						options.map(option => [option.value, option])
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
				onClick: () => {
					showJsonFileListOrderModal(props)
				}
			})
		]),
		tag([props.value.mapArray(
			selectedItem => selectedItem.id,
			selectedItem => {
				const id = selectedItem.get().id
				const itemDef = defByIdMap.map(map => map.get(id) ?? {
					id: id,
					name: id
				})
				return FormField({
					label: itemDef.prop("name"),
					input: NumberInput({
						precision: 2,
						value: selectedItem.prop("weight")
					}),
					hint: (itemDef.get().triggerWords ?? []).length < 1 && !itemDef.get().description ? undefined : tag([
						tag({class: [css.hintDescription, {
							[css.hidden!]: itemDef.prop("description").map(desc => !desc),
							[css.bottomMargin!]: itemDef.prop("triggerWords").map(triggers => triggers && triggers.length > 0)
						}]}, [itemDef.prop("description")]),
						tag(
							{class: [css.hintTriggerList]},
							[itemDef.prop("triggerWords").map(triggers => triggers ?? []).mapArray(
								word => word,
								word => tag({
									class: css.hintTrigger,
									onClick: () => currentPrompt.set(word.get() + " " + currentPrompt.get())
								}, [word]))]
						)
					]),
					revertable: false,
					onDelete: () => {
						props.value.set(props.value.get().filter(item => item.id !== id))
					},
					isFavorite: orderingBox.map(
						values => !values ? false : values.includes(id),
						isFav => {
							const order = orderingBox.get()
							if(!isFav){
								return !order ? order : order.filter(x => x !== id)
							} else {
								return [...(order ?? []), id]
							}
						}
					)
				})
			})]
		)
	])

	bindBox(result, selectValue, value => {
		if(value === null){
			return
		}

		props.value.prependElement({id: value, weight: 1})

		selectValue.set(null)
	})

	return result
}