import {RBox} from "@nartallax/cardboard"
import {bindBox, tag} from "@nartallax/cardboard-dom"
import * as css from "./switch_panel.module.scss"

type Props<T extends string> = {
	routes: {[key in T]: () => HTMLElement}
	value: RBox<T>
	class?: string
}

// TODO: control?
export const SwitchPanel = <T extends string>(props: Props<T>) => {
	const result = tag({class: [css.switchPanel, props.class]})

	function renderRoute(route: T): HTMLElement {
		return props.routes[route]()
	}

	bindBox(result, props.value, route => {
		result.replaceChildren(renderRoute(route))
	})

	return result
}