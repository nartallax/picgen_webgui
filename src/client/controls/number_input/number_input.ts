import {WBox, unbox} from "@nartallax/cardboard"
import {defineControl, tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./number_input.module.scss"

interface NumberInputProps {
	value: WBox<number>
	int?: boolean
	min?: number
	max?: number
	step?: number
	precision?: number
}

const zeroCode = "0".charCodeAt(0)
const nineCode = "9".charCodeAt(0)
const dotCode = ".".charCodeAt(0)
const commaCode = ",".charCodeAt(0)
const minusCode = "-".charCodeAt(0)

function formatToPrecision(value: number, precision?: number): string {
	return value.toFixed(precision ?? 4).replace(/\.?0*$/, "")
}

const defaults = {
	int: false,
	min: undefined,
	max: undefined,
	step: undefined,
	precision: undefined
} satisfies Partial<NumberInputProps>

export const NumberInput = defineControl<NumberInputProps, typeof defaults>(defaults, props => {
	const input = tag({
		tag: "input",
		class: css.numberInput
	})

	const dflt = props.value()

	input.addEventListener("keypress", e => {
		const code = e.key.charCodeAt(0)
		if((code >= zeroCode && code <= nineCode)){
			return
		}
		const min = unbox(props.min)
		if(typeof(min) === "number" && min < 0 && code === minusCode){
			return
		}
		if(!unbox(props.int) && (code === dotCode || code === commaCode)){
			return
		}
		e.preventDefault()
	})

	input.addEventListener("blur", () => {
		const valueStr = input.value
		let valueNum = parseFloat(valueStr.replace(/,/g, "."))
		if(Number.isNaN(valueNum)){
			valueNum = dflt
		}

		const min = unbox(props.min)
		if(typeof(min) === "number" && valueNum < min){
			valueNum = min
		}

		const max = unbox(props.max)
		if(typeof(max) === "number" && valueNum > max){
			valueNum = max
		}

		if(unbox(props.int) && valueNum % 1){
			valueNum = Math.floor(valueNum)
		}

		const step = unbox(props.step)
		if(step && valueNum % step){
			valueNum = Math.round(valueNum / step) * step
		}

		input.value = formatToPrecision(valueNum, unbox(props.precision))
		props.value(valueNum)
	})

	whileMounted(input, props.value, v => {
		input.value = formatToPrecision(v, unbox(props.precision))
	})

	return input
})