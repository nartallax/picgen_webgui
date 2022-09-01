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
			click: () => opts.value(!opts.value())
		}
	}, [
		tag({class: "bool-input-handle"})
	])

	console.trace("render!")

	return result
}