import {tag} from "@nartallax/cardboard-dom"
import {allKnownJsonFileLists, jsonFileListOrdering} from "client/app/global_values"
import {Col} from "client/controls/layout/row_col"
import {showModal} from "client/controls/modal_base/modal"
import {Modal} from "client/controls/modal_base/modal_base"
import {TextBlock} from "client/controls/text_block/text_block"
import {TreeView, TreeViewNode} from "client/controls/tree_view/tree_view"
import * as css from "./json_file_list_input.module.scss"
import {Button} from "client/controls/button/button"
import {JsonFileListItemDescription} from "common/entities/json_file_list"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {JsonFileListGenParam} from "common/entities/parameter"
import {calcBox} from "@nartallax/cardboard"

type Props = {
	def: JsonFileListGenParam
}

export const showJsonFileListOrderModal = (props: Props): Modal => {

	const listName = props.def.directory

	const allItems = allKnownJsonFileLists
		.prop(listName)
		.map(items => items ?? [])

	const listOrderingIds = jsonFileListOrdering.prop(listName)

	const update = (ids: string[]) => {
		jsonFileListOrdering.set({
			...jsonFileListOrdering.get(),
			[listName]: ids
		})
	}
	if(!listOrderingIds.get()){
		update([])
	}

	const activeTreeNodes = listOrderingIds.map(
		itemIds => {
			const itemById = new Map(allItems.get()
				.map(item => [item.id, item] as const))
			const itemIndexById = new Map(allItems.get()
				.map(item => item.id)
				.sort()
				.map((id, index) => [id, index] as const)
			)
			return itemIds.map(itemId => {
				const item = itemById.get(itemId)
				if(!item){
					return null
				}
				return {
					id: itemIndexById.get(itemId) ?? -1,
					value: item
				} satisfies TreeViewNode<JsonFileListItemDescription>
			}).filter((x): x is TreeViewNode<JsonFileListItemDescription> => !!x)
		},
		treeNodes => treeNodes.map(node => node.value.id)
	)

	const inactiveItems = calcBox([allItems, listOrderingIds], (items, listOrderingIds) => {
		const activeItemIds = new Set(listOrderingIds)
		return items.filter(item => !activeItemIds.has(item.id)).sort((a, b) => a.id < b.id ? -1 : 1)
	})

	return showModal({
		title: props.def.uiName + " ordering",
		width: "35rem",
		height: ["0rem", "75vh", null]
	}, [
		Col({gap: true, grow: 1}, [
			TextBlock({
				text: "Here you can add and reorder items for your convenience. Add some items to favorites first; then you can drag-n-drop them to reorder."
			}),
			TreeView({
				nodes: activeTreeNodes,
				canReorder: true,
				grow: 1,
				shrink: 1,
				// TODO: cringe
				render: (item: unknown) => tag({class: css.itemTreeNode}, [
					(item as JsonFileListItemDescription).name,
					Button({
						text: "remove",
						variant: "small",
						onClick: () => {
							update(listOrderingIds.get().filter(id => id !== (item as JsonFileListItemDescription).id))
						}
					})
				])
			}),
			BlockPanelHeader({header: "Not selected items"}),
			tag({class: css.inactiveItemContainer}, [
				inactiveItems.mapArray(item => item.id, item => tag({
					class: css.inactiveItem
				}, [
					tag([item.prop("name")]),
					Button({
						variant: "small",
						iconClass: "icon-star",
						onClick: () => update([...listOrderingIds.get(), item.get().id])
					})
				]))
			])
		])
	])
}