import {getBinder} from "client/base/binder/binder"
import {box, RBox, unbox, WBox} from "client/base/box"
import {ParamLine} from "client/controls/param_line/param_line"
import {SettingsBlock} from "client/controls/settings_block/settings_block"
import {SettingsSubblock} from "client/controls/settings_subblock/settings_subblock"
import {GenParameterDefinition} from "common/common_types"

interface ParamsBlockOptions {
	readonly paramDefs: RBox<null | readonly GenParameterDefinition[]>
	readonly paramValues: {readonly [key: string]: WBox<GenParameterDefinition["default"]>}
}

export function ParamsBlock(opts: ParamsBlockOptions): HTMLElement {

	const contentItems = box([] as HTMLElement[])

	function renderItems(): HTMLElement[] {
		const defs = unbox(opts.paramDefs)

		if(!defs){
			return [SettingsSubblock({header: "Loading..."})]
		}

		const testLines = [] as HTMLElement[]
		const nonTestLines = [] as HTMLElement[]
		for(const def of defs){
			const value = opts.paramValues[def.jsonName]
			if(!value){
				console.error("No value is defined for parameter " + def.jsonName)
				continue
			}
			const line = ParamLine(def, value);
			(def.isTest ? testLines : nonTestLines).push(line)
		}

		const result = [] as HTMLElement[]
		if(nonTestLines.length > 0){
			result.push(SettingsSubblock({header: "Parameters"}, nonTestLines))
		}
		if(testLines.length > 0){
			result.push(SettingsSubblock({header: "Testing"}, testLines))
		}

		return result
	}

	const result = SettingsBlock(contentItems)

	const binder = getBinder(result)
	binder.watchAndRun(opts.paramDefs, () => contentItems(renderItems()))

	return result
}