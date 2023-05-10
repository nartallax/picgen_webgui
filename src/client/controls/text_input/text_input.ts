import {WBox} from "@nartallax/cardboard"
import {defineControl, tag, whileMounted} from "@nartallax/cardboard-dom"

interface TextInputProps {
	value: WBox<string>
	iconClass?: string
	updateAsUserType?: boolean
	maxLength?: number
	minLength?: number
}

const defaults = {
	iconClass: undefined,
	updateAsUserType: false,
	maxLength: undefined,
	minLength: undefined
} satisfies Partial<TextInputProps>

export const TextInput = defineControl<TextInputProps, typeof defaults>(defaults, props => {
	const input: HTMLInputElement = tag({
		tag: "input",
		class: "input text-input",
		onBlur: () => props.value(input.value)
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
		class: ["text-input-icon", props.iconClass, {
			hidden: props.iconClass.map(cls => !cls)
		}]
	})

	const wrap = tag({
		class: "text-input-wrap"
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