import {getBinder} from "client/base/binder/binder"
import {RBox, WBox} from "client/base/box"
import {tag} from "client/base/tag"

interface VisibilityNotifierOptions {
	isOnScreen: WBox<boolean>
	hide: RBox<boolean>
}

export function VisibilityNotifier(opts: VisibilityNotifierOptions, children?: HTMLElement[]): HTMLElement {
	const result = tag({class: ["visibility-notifier", {
		hidden: opts.hide
	}]}, children || [])

	const observer = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if(entry.target === result){
				opts.isOnScreen(entry.isIntersecting)
			}
		})
	}, {
		threshold: 0.1
	})

	const binder = getBinder(result)
	binder.onNodeInserted(() => observer.observe(result))
	binder.onNodeRemoved(() => observer.unobserve(result))

	return result
}