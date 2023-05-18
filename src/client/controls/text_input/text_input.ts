import {WBox} from "@nartallax/cardboard"
import {defineControl, tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./text_input.module.scss"

interface TextInputProps {
	value: WBox<string>
	iconClass?: string
	updateAsUserType?: boolean
	maxLength?: number
	minLength?: number
	disabled?: boolean
}

const defaults = {
	iconClass: undefined,
	updateAsUserType: false,
	maxLength: undefined,
	minLength: undefined,
	disabled: false
} satisfies Partial<TextInputProps>

export const TextInput = defineControl<TextInputProps, typeof defaults>(defaults, props => {
	const input: HTMLInputElement = tag({
		tag: "input",
		class: css.textInput,
		onBlur: () => props.value(input.value),
		attrs: {
			disabled: props.disabled
		}
	})

	function clamp(x: string): string {
		const min = props.minLength()
		if(min !== undefined){
			while(x.length < min){
				x += "?"
			}
		}

		const max = props.maxLength()
		if(max !== undefined && x.length > max){
			x = x.substring(0, max)
		}
		return x
	}

	if(props.updateAsUserType()){
		input.addEventListener("input", () => {
			const v = clamp(input.value)
			props.value(v)
			if(v !== input.value){
				input.value = v
			}
		})
	}

	const iconEl = tag({
		class: [css.textInputIcon, props.iconClass, {
			[css.hidden!]: props.iconClass.map(cls => !cls)
		}]
	})

	const wrap = tag({
		class: css.textInputWrap
	}, [
		input,
		iconEl
	])

	whileMounted(input, props.value, v => {
		const clamped = clamp(v)
		if(clamped !== v){
			props.value(clamped)
		} else {
			input.value = clamped
		}
	})

	return wrap
})