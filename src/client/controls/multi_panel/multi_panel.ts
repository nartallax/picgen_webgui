import {RBox} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./multi_panel.module.scss"

interface MultiPanelProps<T extends string = string> {
	items: Record<T, () => HTMLElement>
	value: RBox<T>
}

// TODO: deprecate in favor of SwitchPanel? they do the same thing
export const MultiPanel = defineControl(<T extends string = string>(props: MultiPanelProps<T>) => {
	return tag({class: css.multiPanel}, [
		props.value.map(value => props.items[value]!())
	])
})