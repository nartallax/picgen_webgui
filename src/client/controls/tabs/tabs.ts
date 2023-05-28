import {WBox, viewBox} from "@nartallax/cardboard"
import {BoxedProps, defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./tabs.module.scss"

type Props<T> = {
	options: readonly {label: string, value: T}[]
	value: WBox<T>
}

export const Tabs = defineControl<Props<unknown>>(<T>(props: BoxedProps<Props<T>>) => {
	return tag({class: css.tabs}, props.options.mapArray(
		option => option.value,
		option => tag({
			tag: "button",
			class: [
				css.tab,
				{[css.active!]: viewBox(() => props.value() === option().value)}
			],
			onClick: () => props.value(option().value)
		}, [option.prop("label")])
	))
})