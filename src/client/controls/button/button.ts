import {box, MaybeRBoxed, unbox, viewBox} from "client/base/box"
import {tag} from "client/base/tag"

interface ButtonOptions {
	onclick(): void | Promise<void>
	text?: MaybeRBoxed<string>
	iconClass?: MaybeRBoxed<string>
}

export function Button(opts: ButtonOptions): HTMLElement {

	const clickIsActive = box(false)

	async function wrappedOnclick() {
		clickIsActive(true)
		try {
			await Promise.resolve(opts.onclick())
		} finally {
			clickIsActive(false)
		}
	}

	return tag({
		tagName: "button",
		class: ["button", opts.iconClass, {
			disabled: clickIsActive,
			"more-h-padding": viewBox(() => !!unbox(opts.text))
		}],
		on: {click: wrappedOnclick},
		text: opts.text
	})
}