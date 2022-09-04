import {getBinder} from "client/base/binder/binder"
import {RBox} from "client/base/box"
import {tag} from "client/base/tag"

interface MultiPanelOptions<T extends string = string> {
	items: Record<T, () => HTMLElement>
	value: RBox<T>
}

export function MultiPanel<T extends string = string>(opts: MultiPanelOptions<T>): HTMLElement {
	const result = tag({class: "multi-panel"})

	const binder = getBinder(result)
	binder.watchAndRun(opts.value, value => {
		const renderer = opts.items[value]!
		const item = renderer()
		while(result.firstChild){
			result.firstChild.remove()
		}
		result.appendChild(item)
	})

	return result
}