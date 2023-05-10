import {MRBox, RBox, WBox, box, unbox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {ParamLine} from "client/controls/param_line/param_line"
import {SettingsBlock} from "client/controls/settings_block/settings_block"
import {SettingsSubblockHeader} from "client/controls/settings_subblock_header/settings_subblock_header"
import {GenParameterGroup} from "common/common_types"
import {GenerationTaskParameterValue} from "common/entity_types"
import * as css from "./params_block.module.scss"

interface ParamsBlockProps {
	readonly paramGroups: RBox<null | readonly GenParameterGroup[]>
	readonly paramValues: {readonly [key: string]: WBox<GenerationTaskParameterValue>}
	readonly paramSetName: MRBox<string>
}

export function ParamsBlock(props: ParamsBlockProps): HTMLElement {

	const contentItems = box([] as HTMLElement[])

	function renderItems(): HTMLElement[] {
		const groups = unbox(props.paramGroups)

		if(!groups){
			return [SettingsSubblockHeader({header: "Loading..."})]
		}

		const lines: HTMLElement[] = []

		for(const group of groups){
			const defs = group.parameters

			const groupToggle = !group.toggle ? undefined : (props.paramValues[group.toggle.jsonName] as WBox<boolean>)

			lines.push(tag({
				tag: "tr",
				class: "params-block-header"
			}, [
				tag({
					tag: "td",
					attrs: {colspan: 3}
				}, [
					SettingsSubblockHeader({
						header: group.uiName,
						toggle: groupToggle
					})
				])
			]))

			for(const def of defs){
				const value = props.paramValues[def.jsonName]
				if(!value){
					console.error("No value is defined for parameter " + def.jsonName)
					continue
				}
				lines.push(ParamLine({paramSetName: props.paramSetName, def, value, visible: groupToggle}))
			}

		}

		const table = tag({tag: "table", class: css.paramsBlockTable}, lines)

		return [table]
	}

	const result = SettingsBlock(contentItems)

	whileMounted(result, props.paramGroups, () => contentItems(renderItems()))

	return result
}