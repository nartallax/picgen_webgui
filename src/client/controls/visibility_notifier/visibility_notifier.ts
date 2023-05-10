import {WBox} from "@nartallax/cardboard"
import {defineControl, onMount, tag} from "@nartallax/cardboard-dom"

interface VisibilityNotifierProps {
	isOnScreen: WBox<boolean>
	hide?: boolean
}

export const VisibilityNotifier = defineControl<VisibilityNotifierProps>((props, children) => {
	const result = tag({class: ["visibility-notifier", {
		hidden: props.hide
	}]}, children || [])

	const observer = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if(entry.target === result){
				props.isOnScreen(entry.isIntersecting)
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