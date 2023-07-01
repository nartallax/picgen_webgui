import {WBox} from "@nartallax/cardboard"
import {defineControl, tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./text_input.module.scss"

interface TextInputProps {
	value: WBox<string>
	updateAsUserType?: boolean
	maxLength?: number
	minLength?: number
	disabled?: boolean
	lineCount?: number
}

const defaults = {
	updateAsUserType: false,
	maxLength: undefined,
	minLength: undefined,
	disabled: false,
	lineCount: 1
} satisfies Partial<TextInputProps>

export const TextInput = defineControl<TextInputProps, typeof defaults>(defaults, props => {
	const isTextarea = props.lineCount() === 1
	const input: HTMLInputElement | HTMLTextAreaElement = tag({
		tag: isTextarea ? "input" : "textarea",
		class: css.textInput,
		onBlur: () => props.value(input.value),
		attrs: {
			disabled: props.disabled,
			rows: isTextarea ? undefined : props.lineCount
		},
		style: {
			resize: isTextarea ? undefined : "none"
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

	const wrap = tag({class: css.textInputWrap}, [input])

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