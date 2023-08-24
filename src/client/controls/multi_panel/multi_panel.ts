import {RBox} from "@nartallax/cardboard"
import {bindBox, tag} from "@nartallax/cardboard-dom"
import * as css from "./multi_panel.module.scss"

interface MultiPanelProps<T extends string = string> {
	items: Record<T, () => HTMLElement>
	value: RBox<T>
}

// TODO: control?
// TODO: deprecate in favor of SwitchPanel? they do the same thing
export function MultiPanel<T extends string = string>(props: MultiPanelProps<T>): HTMLElement {
	const result = tag({class: css.multiPanel})

	bindBox(result, props.value, value => {
		result.replaceChildren(props.items[value]!())
	})

	return result
}