import {WBox} from "client/base/box"
import {tag} from "client/base/tag"

interface BoolInputOptions {
	readonly value: WBox<boolean>
}

export function BoolInput(opts: BoolInputOptions): HTMLElement {
	const result = tag({
		class: ["input bool-input", {
			on: opts.value
		}],
		on: {
			click: () => opts.value(!opts.value()),
			keydown: e => {
				if(e.key === "Enter" || e.key === "Space" || e.key === " "){
					opts.value(!opts.value())
				}
			}
		}
	}, [
		tag({class: "bool-input-handle"})
	])

	result.tabIndex = 0

	return result
}