import {MRBox, WBox, constBoxWrap, unbox} from "@nartallax/cardboard"
import {bindBox, defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./text_input.module.scss"

interface TextInputProps {
	value: WBox<string>
	updateAsUserType?: MRBox<boolean>
	maxLength?: MRBox<number>
	minLength?: MRBox<number>
	disabled?: MRBox<boolean>
	lineCount?: MRBox<number>
}

export const TextInput = defineControl((props: TextInputProps) => {
	const lineCount = constBoxWrap(props.lineCount ?? 1)
	const minLength = constBoxWrap(props.minLength)
	const maxLength = constBoxWrap(props.maxLength)

	const isTextarea = lineCount.get() === 1
	const input: HTMLInputElement | HTMLTextAreaElement = tag({
		tag: isTextarea ? "input" : "textarea",
		class: css.textInput,
		onBlur: () => props.value.set(input.value),
		attrs: {
			disabled: props.disabled,
			rows: isTextarea ? undefined : props.lineCount
		},
		style: {
			resize: isTextarea ? undefined : "none"
		}
	})

	function clamp(x: string): string {
		const min = minLength.get()
		if(min !== undefined){
			while(x.length < min){
				x += "?"
			}
		}

		const max = maxLength.get()
		if(max !== undefined && x.length > max){
			x = x.substring(0, max)
		}
		return x
	}

	if(unbox(props.updateAsUserType)){
		input.addEventListener("input", () => {
			const v = clamp(input.value)
			props.value.set(v)
			if(v !== input.value){
				input.value = v
			}
		})
	}

	const wrap = tag({class: css.textInputWrap}, [input])

	bindBox(input, props.value, v => {
		const clamped = clamp(v)
		if(clamped !== v){
			props.value.set(clamped)
		} else {
			input.value = clamped
		}
	})

	return wrap
})