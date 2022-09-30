import {getBinder} from "client/base/binder/binder"
import {MaybeRBoxed, unbox, viewBox, WBox} from "client/base/box"
import {tag} from "client/base/tag"

interface TextInputOptions {
	value: WBox<string>
	iconClass?: MaybeRBoxed<string>
	updateAsUserType?: boolean
	maxLength?: number
	minLength?: number
}

export function TextInput(opts: TextInputOptions): HTMLElement {
	const input: HTMLInputElement = tag({
		tagName: "input",
		class: "input text-input",
		on: {
			blur: () => opts.value(input.value)
		}
	})

	function clamp(x: string): string {
		if(opts.minLength !== undefined){
			while(x.length < opts.minLength){
				x += "?"
			}
		}
		if(opts.maxLength !== undefined && x.length > opts.maxLength){
			x = x.substring(0, opts.maxLength)
		}
		return x
	}

	if(opts.updateAsUserType){
		input.addEventListener("input", () => {
			const v = clamp(input.value)
			opts.value(v)
			if(v !== input.value){
				input.value = v
			}
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
	binder.watchAndRun(opts.value, v => {
		const clamped = clamp(v)
		if(clamped !== v){
			opts.value(clamped)
		} else {
			input.value = clamped
		}
	})

	return wrap
}