import {RBox, WBox, box, calcBox} from "@nartallax/cardboard"
import {bindBox, tag} from "@nartallax/cardboard-dom"
import {allKnownJsonFileLists, jsonFileListOrdering, userStaticPictureInfo} from "client/app/global_values"
import {showJsonFileListOrderModal} from "client/components/json_file_list_input/json_file_list_ordering"
import {Button} from "client/controls/button/button"
import {FormField} from "client/controls/form/form"
import {Row} from "client/controls/layout/row_col"
import {NumberInput} from "client/controls/number_input/number_input"
import {Select} from "client/controls/select/select"
import {JsonFileListArgument, JsonFileListItemDescription} from "common/entities/json_file_list"
import {JsonFileListGenParam} from "common/entities/parameter"
import * as css from "./json_file_list_input.module.scss"
import {Icon} from "client/generated/icons"
import {LockButton} from "client/controls/lock_button/lock_button"
import {userStaticThumbnailProvider} from "client/pages/main_page/user_static_thumbnail_provider"
import {showImageViewer} from "client/components/image_viewer/image_viewer"
import {ClientApi} from "client/app/client_api"

type Props = {
	def: JsonFileListGenParam
	value: WBox<JsonFileListArgument[]>
	prompt: WBox<string>
	isLocked?: WBox<boolean>
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
			!props.isLocked ? null : LockButton({isLocked: props.isLocked}),
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
				icon: Icon.cog,
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
				const def = itemDef.get()
				return FormField({
					label: itemDef.prop("name"),
					input: NumberInput({
						precision: 2,
						value: selectedItem.prop("weight")
					}),
					hint: (def.triggerWords ?? []).length < 1 && !def.description && (def.images ?? []).length < 1 ? undefined : tag({
						class: css.hint
					}, [
						tag({class: {
							[css.hidden!]: itemDef.prop("description").map(desc => !desc)
						}}, [itemDef.prop("description")]),

						tag({class: [css.hintImages, {
							[css.hidden!]: itemDef.prop("images").map(imgs => !imgs || imgs.length < 1)
						}]}, [
							itemDef.prop("images").map(imgs =>
								(imgs ?? []).map(img => makeThumbnail(img, itemDef))
							)
						]),

						tag(
							{class: [css.hintTriggerList, {
								[css.hidden!]: itemDef.prop("triggerWords").map(words => !words || words.length < 1)
							}]},
							[itemDef.prop("triggerWords").map(triggers => triggers ?? []).mapArray(
								word => word,
								word => tag({
									class: css.hintTrigger,
									onClick: () => props.prompt.set(word.get() + " " + props.prompt.get())
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

function makeThumbnail(path: string, def: RBox<JsonFileListItemDescription>): HTMLImageElement | null {
	const img = userStaticThumbnailProvider.getThumbnailNow(path)
	if(!img){
		return null
	}

	img.addEventListener("click", () => openJsonListItemImageViewer(def))

	return img
}

function openJsonListItemImageViewer(def: RBox<JsonFileListItemDescription>): void {
	const sizeMap = new Map(userStaticPictureInfo.get().map(x => [x.name, x]))
	void showImageViewer({
		imageDescriptions: def.prop("images").map(imgs => imgs ?? []),
		makeUrl: img => ClientApi.getUserStaticPictureUrl(img),
		getDimensions: img => sizeMap.get(img) ?? {width: 10, height: 10}
	})
}