import {WBox, box} from "@nartallax/cardboard"

export function localStorageBox<T>(name: string): WBox<T | undefined>
export function localStorageBox<T>(name: string, defaultValue: T): WBox<T>
export function localStorageBox<T>(name: string, defaultValue?: T): WBox<T | undefined> {
	const initialValueStr = localStorage.getItem(name)
	const b = box(typeof(initialValueStr) === "string" ? JSON.parse(initialValueStr) : defaultValue)

	b.subscribe(newValue => {
		if(newValue === undefined){
			localStorage.removeItem(name)
		} else {
			localStorage.setItem(name, JSON.stringify(newValue))
		}
	})

	return b
}