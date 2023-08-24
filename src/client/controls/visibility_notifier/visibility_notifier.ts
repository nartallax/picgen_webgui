import {MRBox, WBox} from "@nartallax/cardboard"
import {defineControl, onMount, tag} from "@nartallax/cardboard-dom"
import * as css from "./visibility_notifier.module.scss"

interface VisibilityNotifierProps {
	isOnScreen: WBox<boolean>
	hide?: MRBox<boolean>
}

export const VisibilityNotifier = defineControl((props: VisibilityNotifierProps, children) => {
	const result = tag({class: [css.visibilityNotifier, {
		[css.hidden!]: props.hide
	}]}, children || [])

	const observer = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if(entry.target === result){
				props.isOnScreen.set(entry.isIntersecting)
			}
		})
	}, {
		threshold: 0.1
	})

	onMount(result, () => {
		observer.observe(result)
		return () => observer.unobserve(result)
	})

	return result
})