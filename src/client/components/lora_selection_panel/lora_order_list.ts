import {viewBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {allKnownLoras, loraOrdering} from "client/app/global_values"
import {Col} from "client/controls/layout/row_col"
import {showModal} from "client/controls/modal_base/modal"
import {Modal} from "client/controls/modal_base/modal_base"
import {TextBlock} from "client/controls/text_block/text_block"
import {TreeView, TreeViewNode} from "client/controls/tree_view/tree_view"
import * as css from "./lora_selection_panel.module.scss"
import {Button} from "client/controls/button/button"
import {LoraDescription} from "common/entities/lora"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"

export const showLoraOrderListModal = (): Modal => {

	const activeTreeNodes = loraOrdering.map(
		loraIds => {
			const loraById = new Map(allKnownLoras()
				.map(lora => [lora.id, lora] as const))
			const loraIndexById = new Map(allKnownLoras()
				.map(lora => lora.id)
				.sort()
				.map((id, index) => [id, index] as const)
			)
			return loraIds.map(loraId => {
				const lora = loraById.get(loraId)
				if(!lora){
					return null
				}
				return {
					id: loraIndexById.get(loraId) ?? -1,
					value: lora
				} satisfies TreeViewNode<LoraDescription>
			}).filter((x): x is TreeViewNode<LoraDescription> => !!x)
		},
		treeNodes => treeNodes.map(node => node.value.id)
	)

	const inactiveLoras = viewBox(() => {
		const allLoras = allKnownLoras()
		const activeLoraIds = new Set(loraOrdering())
		return allLoras.filter(lora => !activeLoraIds.has(lora.id)).sort((a, b) => a.id < b.id ? -1 : 1)
	})

	return showModal({
		title: "LoRA ordering",
		width: "35rem",
		height: ["0rem", "75vh", null]
	}, [
		Col({gap: true, grow: 1}, [
			TextBlock({
				text: "Here you can add and reorder LoRAs for your convenience. Add some LoRAs to favorites first; then you can drag-n-drop them to reorder."
			}),
			TreeView({
				nodes: activeTreeNodes,
				canReorder: true,
				grow: 1,
				shrink: 1,
				// TODO: cringe
				render: (lora: unknown) => tag({class: css.loraTreeNode}, [
					(lora as LoraDescription).name,
					Button({
						text: "remove",
						variant: "small",
						onclick: () => {
							loraOrdering(loraOrdering().filter(id => id !== (lora as LoraDescription).id))
						}
					})
				])
			}),
			BlockPanelHeader({header: "Not selected LoRAs"}),
			tag({class: css.inactiveLoraContainer}, inactiveLoras.mapArray(lora => lora.id, lora => tag({
				class: css.inactiveLora
			}, [
				tag([lora.prop("name")]),
				Button({
					variant: "small",
					iconClass: "icon-star",
					onclick: () => {
						loraOrdering([...loraOrdering(), lora().id])
					}
				})
			])))
		])
	])
}