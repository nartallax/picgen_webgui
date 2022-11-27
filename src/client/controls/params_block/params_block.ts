import {getBinder} from "client/base/binder/binder"
import {box, RBox, unbox, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {ParamLine} from "client/controls/param_line/param_line"
import {SettingsBlock} from "client/controls/settings_block/settings_block"
import {SettingsSubblockHeader} from "client/controls/settings_subblock_header/settings_subblock_header"
import {GenParameterDefinition} from "common/common_types"
import {GenerationTaskParameterValue} from "common/entity_types"

interface ParamsBlockOptions {
	readonly paramDefs: RBox<null | readonly GenParameterDefinition[]>
	readonly paramValues: {readonly [key: string]: WBox<GenerationTaskParameterValue>}
}

export function ParamsBlock(opts: ParamsBlockOptions): HTMLElement {

	const contentItems = box([] as HTMLElement[])

	function renderItems(): HTMLElement[] {
		const defs = unbox(opts.paramDefs)

		if(!defs){
			return [SettingsSubblockHeader({header: "Loading..."})]
		}

		const testLines = [] as HTMLElement[]
		const nonTestLines = [] as HTMLElement[]
		for(const def of defs){
			const value = opts.paramValues[def.jsonName]
			if(!value){
				console.error("No value is defined for parameter " + def.jsonName)
				continue
			}
			const line = ParamLine(def, value, opts.paramValues);
			(def.isTest ? testLines : nonTestLines).push(line)
		}

		const table = tag({tagName: "table", class: "params-block-table"})

		function addLines(header: string, lines: HTMLElement[]): void {
			table.appendChild(tag({
				tagName: "tr",
				class: "params-block-header"
			}, [
				tag({
					tagName: "td",
					attrs: {colspan: 3}
				}, [
					SettingsSubblockHeader({header})
				])
			]))
			for(const line of lines){
				table.appendChild(line)
			}
		}

		if(nonTestLines.length > 0){
			addLines("Parameters", nonTestLines)
		}
		if(testLines.length > 0){
			addLines("Testing", testLines)
		}

		return [table]
	}

	const result = SettingsBlock(contentItems)

	const binder = getBinder(result)
	binder.watchAndRun(opts.paramDefs, () => contentItems(renderItems()))

	return result
}