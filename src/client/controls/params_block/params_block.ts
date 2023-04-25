import {getBinder} from "client/base/binder/binder"
import {box, MaybeRBoxed, RBox, unbox, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {ParamLine} from "client/controls/param_line/param_line"
import {SettingsBlock} from "client/controls/settings_block/settings_block"
import {SettingsSubblockHeader} from "client/controls/settings_subblock_header/settings_subblock_header"
import {GenParameterGroup} from "common/common_types"
import {GenerationTaskParameterValue} from "common/entity_types"

interface ParamsBlockOptions {
	readonly paramGroups: RBox<null | readonly GenParameterGroup[]>
	readonly paramValues: {readonly [key: string]: WBox<GenerationTaskParameterValue>}
	readonly paramSetName: MaybeRBoxed<string>
}

export function ParamsBlock(opts: ParamsBlockOptions): HTMLElement {

	const contentItems = box([] as HTMLElement[])

	function renderItems(): HTMLElement[] {
		const groups = unbox(opts.paramGroups)

		if(!groups){
			return [SettingsSubblockHeader({header: "Loading..."})]
		}

		const lines: HTMLElement[] = []

		for(const group of groups){
			const defs = group.parameters

			const groupToggle = !group.toggle ? undefined : (opts.paramValues[group.toggle.jsonName] as WBox<boolean>)

			lines.push(tag({
				tagName: "tr",
				class: "params-block-header"
			}, [
				tag({
					tagName: "td",
					attrs: {colspan: 3}
				}, [
					SettingsSubblockHeader({
						header: group.uiName,
						toggle: groupToggle
					})
				])
			]))

			for(const def of defs){
				const value = opts.paramValues[def.jsonName]
				if(!value){
					console.error("No value is defined for parameter " + def.jsonName)
					continue
				}
				lines.push(ParamLine(opts.paramSetName, def, value, groupToggle))
			}

		}

		const table = tag({tagName: "table", class: "params-block-table"}, lines)

		return [table]
	}

	const result = SettingsBlock(contentItems)

	const binder = getBinder(result)
	binder.watchAndRun(opts.paramGroups, () => contentItems(renderItems()))

	return result
}