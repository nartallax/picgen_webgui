import {getBinder} from "client/base/binder/binder"
import {MaybeRBoxed, unbox, viewBox, WBox} from "client/base/box"
import {tag} from "client/base/tag"

interface TextInputOptions {
	value: WBox<string>
	iconClass?: MaybeRBoxed<string>
	updateAsUserType?: boolean
}

export function TextInput(opts: TextInputOptions): HTMLElement {
	const input: HTMLInputElement = tag({
		tagName: "input",
		class: "input text-input",
		on: {
			blur: () => opts.value(input.value)
		}
	})

	if(opts.updateAsUserType){
		input.addEventListener("input", () => {
			opts.value(input.value)
		})
	}

	const iconEl = tag({
		class: ["text-input-icon", opts.iconClass, {
			hidden: viewBox(() => !unbox(opts.iconClass))
		}]
	})

	const wrap = tag({
		class: "text-input-wrap"
	}, [
		input,
		iconEl
	])

	const binder = getBinder(input)
	binder.subscribeAndFireIfInDom(opts.value, v => input.value = v)

	return wrap
}