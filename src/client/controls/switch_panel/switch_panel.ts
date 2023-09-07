import {RBox} from "@nartallax/cardboard"
import {bindBox, defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./switch_panel.module.scss"

type Props<T extends string> = {
	routes: {[key in T]: () => HTMLElement}
	value: RBox<T>
	class?: string
}

export const SwitchPanel = defineControl(<T extends string>(props: Props<T>) => {
	const result = tag({class: [css.switchPanel, props.class]})

	function renderRoute(route: T): HTMLElement {
		return props.routes[route]()
	}

	bindBox(result, props.value, route => {
		const oldChild = result.lastElementChild as HTMLElement | null
		const newChild = renderRoute(route)
		clearOldChild(newChild) // just in case

		if(oldChild){
			oldChild.classList.remove(css.upcomingSwitchElement!)
			oldChild.classList.add(css.decayingSwitchElement!)
			const rect = result.getBoundingClientRect()
			oldChild.style.width = rect.width + "px"
			oldChild.style.height = rect.height + "px"
		}
		newChild.classList.add(css.upcomingSwitchElement!)
		result.appendChild(newChild)

		setTimeout(() => {
			if(oldChild){
				oldChild.remove()
				clearOldChild(oldChild)
			}
			newChild.classList.remove(css.upcomingSwitchElement!)
		}, 250)
	})

	return result
})

function clearOldChild(oldChild: HTMLElement): void {
	oldChild.style.height = ""
	oldChild.style.width = ""
	oldChild.classList.remove(css.decayingSwitchElement!)
}