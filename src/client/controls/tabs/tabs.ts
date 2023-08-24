import {WBox, calcBox, constBoxWrap} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./tabs.module.scss"

type Props<T> = {
	options: readonly {label: string, value: T}[]
	value: WBox<T>
}

export const Tabs = defineControl(<T>(props: Props<T>) => {
	return tag({class: css.tabs},
		[constBoxWrap(props.options).mapArray(
			option => option.value,
			option => tag({
				tag: "button",
				class: [
					css.tab,
					{[css.active!]: calcBox([props.value, option], (value, option) => value === option.value)}
				],
				onClick: () => props.value.set(option.get().value)
			}, [option.prop("label")]))]
	)
})