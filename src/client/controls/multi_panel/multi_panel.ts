import {RBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"

interface MultiPanelProps<T extends string = string> {
	items: Record<T, () => HTMLElement>
	value: RBox<T>
}

export function MultiPanel<T extends string = string>(props: MultiPanelProps<T>): HTMLElement {
	return tag({class: "multi-panel"}, props.value.map(value => [props.items[value]!()]))
}