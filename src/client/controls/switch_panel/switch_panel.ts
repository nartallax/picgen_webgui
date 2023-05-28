import {RBox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./switch_panel.module.scss"

type Props<T extends string> = {
	routes: {[key in T]: () => HTMLElement}
	value: RBox<T>
	class?: string
}

export const SwitchPanel = <T extends string>(props: Props<T>) => {
	const result = tag({class: [css.switchPanel, props.class]})

	function renderRoute(route: T): HTMLElement {
		return props.routes[route]()
	}

	whileMounted(result, props.value, route => {
		while(result.firstChild){
			result.firstChild.remove()
		}
		result.appendChild(renderRoute(route))
	})

	return result
}