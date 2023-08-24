import {WBox, unbox} from "@nartallax/cardboard"
import {bindBox, defineControl, tag} from "@nartallax/cardboard-dom"
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

export const NumberInput = defineControl((props: NumberInputProps) => {

	const dflt = props.value.get()

	const fixValue = (valueNum: number) => {
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

		return valueNum
	}

	const fixAndUpdateValue = () => {
		const valueStr = input.value
		let valueNum = parseFloat(valueStr.replace(/,/g, "."))
		valueNum = fixValue(valueNum)
		input.value = formatToPrecision(valueNum, unbox(props.precision))
		props.value.set(valueNum)
	}

	const tryUpdateValueWithoutFixing = () => {
		const valueStr = input.value
		const valueNum = parseFloat(valueStr.replace(/,/g, "."))
		const fixedValue = fixValue(valueNum)
		if(formatToPrecision(fixedValue, unbox(props.precision)) === valueStr){
			props.value.set(valueNum)
		}
	}

	const input = tag({
		tag: "input",
		class: css.numberInput,
		onKeydown: tryUpdateValueWithoutFixing,
		onKeyup: tryUpdateValueWithoutFixing,
		onInput: tryUpdateValueWithoutFixing,
		onChange: tryUpdateValueWithoutFixing
	})

	input.addEventListener("keypress", e => {
		if(e.key === "Enter"){
			fixAndUpdateValue()
		}
		const code = e.key.charCodeAt(0)
		if((code >= zeroCode && code <= nineCode)){
			return
		}
		const min = unbox(props.min)
		if(code === minusCode && (min === undefined || min < 0)){
			return
		}
		if(!unbox(props.int) && (code === dotCode || code === commaCode)){
			return
		}
		e.preventDefault()
	})

	input.addEventListener("blur", fixAndUpdateValue)

	bindBox(input, props.value, v => {
		input.value = formatToPrecision(v, unbox(props.precision))
	})

	return input
})