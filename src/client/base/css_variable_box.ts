import {box} from "@nartallax/cardboard"
import {bindBox} from "@nartallax/cardboard-dom"

export const globalCssVariableLocalStorageBox = (name: string, initialValue: string) => {
	const result = box(initialValue)

	bindBox(document.body, result, {type: "cssVariable", name})
	bindBox(document.body, result, {
		type: "localStorage",
		key: "cssVariableLocalStorage:" + name,
		parse: value => value === null ? initialValue : JSON.parse(value),
		serialize: value => JSON.stringify(value)
	})

	return result
}