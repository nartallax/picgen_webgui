import {getBinder} from "client/base/binder/binder"
import {unbox, WBox} from "client/base/box"
import {ControlOptions} from "client/base/control"
import {tag} from "client/base/tag"

interface NumberInputOptions {
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
const minusCode = "-".charCodeAt(0)

function formatToPrecision(value: number, precision?: number): string {
	return value.toFixed(precision ?? 4).replace(/\.?0*$/, "")
}

export function NumberInput(opts: ControlOptions<NumberInputOptions>): HTMLElement {
	const input = tag({
		tagName: "input",
		class: "input number-input"
	})

	const dflt = opts.value()

	input.addEventListener("keypress", e => {
		const code = e.key.charCodeAt(0)
		if((code >= zeroCode && code <= nineCode)){
			return
		}
		const min = unbox(opts.min)
		if(typeof(min) === "number" && min < 0 && code === minusCode){
			return
		}
		if(!unbox(opts.int) && code === dotCode){
			return
		}
		e.preventDefault()
	})

	input.addEventListener("blur", () => {
		const valueStr = input.value
		let valueNum = parseFloat(valueStr)
		if(Number.isNaN(valueNum)){
			valueNum = dflt
		}

		const min = unbox(opts.min)
		if(typeof(min) === "number" && valueNum < min){
			valueNum = min
		}

		const max = unbox(opts.max)
		if(typeof(max) === "number" && valueNum > max){
			valueNum = max
		}

		if(unbox(opts.int) && valueNum % 1){
			valueNum = Math.floor(valueNum)
		}

		const step = unbox(opts.step)
		if(step && valueNum % step){
			valueNum = Math.round(valueNum / step) * step
		}

		input.value = formatToPrecision(valueNum, unbox(opts.precision))
		opts.value(valueNum)
	})

	const binder = getBinder(input)
	binder.watch(opts.value, v => {
		input.value = formatToPrecision(v, unbox(opts.precision))
	})

	return input
}