import {getBinder} from "client/base/binder/binder"
import {box, isRBox, unbox} from "client/base/box"
import {ControlOptions} from "client/base/control"
import {ParamDefWithValue} from "client/client_types"
import {ParamLine} from "client/controls/param_line/param_line"
import {SettingsBlock} from "client/controls/settings_block/settings_block"
import {SettingsSubblock} from "client/controls/settings_subblock/settings_subblock"

interface ParamsBlockOptions {
	readonly paramDefs: null | ParamDefWithValue[]
}

export function ParamsBlock(opts: ControlOptions<ParamsBlockOptions>): HTMLElement {

	const contentItems = box([] as HTMLElement[])

	function renderItems(): HTMLElement[] {
		const items = unbox(opts.paramDefs)

		if(!items){
			return [SettingsSubblock({header: "Loading..."})]
		}

		const testLines = [] as HTMLElement[]
		const nonTestLines = [] as HTMLElement[]
		for(const item of items){
			const line = ParamLine(item);
			(item.isTest ? testLines : nonTestLines).push(line)
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

	if(isRBox(opts.paramDefs)){
		const binder = getBinder(result)
		binder.watch(opts.paramDefs, () => contentItems(renderItems()))
	} else {
		contentItems(renderItems())
	}

	return result
}