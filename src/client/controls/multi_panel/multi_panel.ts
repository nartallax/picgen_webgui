import {RBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import * as css from "./multi_panel.module.scss"

interface MultiPanelProps<T extends string = string> {
	items: Record<T, () => HTMLElement>
	value: RBox<T>
}

export function MultiPanel<T extends string = string>(props: MultiPanelProps<T>): HTMLElement {
	return tag({class: css.multiPanel}, props.value.map(value => [props.items[value]!()]))
}