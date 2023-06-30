import {localStorageBox} from "@nartallax/cardboard-dom"

export const cssVariableLocalStorageBox = (name: string, initialValue: string, element: HTMLElement = document.body) => {
	const res = localStorageBox("cssVariableLocalStorage:" + name, initialValue)
	res.subscribe(newValue => {
		element.style.setProperty(name, newValue)
	})
	element.style.setProperty(name, res())
	return res
}