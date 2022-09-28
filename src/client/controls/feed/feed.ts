import {getBinder} from "client/base/binder/binder"
import {box, WBox} from "client/base/box"
import {renderArray, tag} from "client/base/tag"
import {VisibilityNotifier} from "client/controls/visibility_notifier/visibility_notifier"

interface FeedOptions<T> {
	values: WBox<T[]>
	loadNext(currentValues: T[]): T[] | Promise<T[]>
	getId(value: T): string | number
	renderElement(value: WBox<T>): HTMLElement
	bottomLoadingPlaceholder: HTMLElement
}

export function Feed<T>(opts: FeedOptions<T>): HTMLElement {
	const isBottomVisible = box(false)
	const reachedEndOfFeed = box(false)
	let isLoadingNow = false

	const result = tag({class: "feed"}, [
		tag({
			class: "feed-items-container"
		}, renderArray(opts.values, opts.getId, opts.renderElement)),
		VisibilityNotifier({
			isOnScreen: isBottomVisible,
			hide: reachedEndOfFeed
		}, [opts.bottomLoadingPlaceholder])
	])

	async function loadNext(): Promise<void> {
		let currentValues = opts.values()
		console.log("Loading next, starting with " + currentValues.length)
		const newValues = await Promise.resolve(opts.loadNext(currentValues))
		reachedEndOfFeed(newValues.length === 0)
		currentValues = [...currentValues, ...newValues]
		opts.values(currentValues)
	}

	const binder = getBinder(result)
	binder.watch(isBottomVisible, async visible => {
		if(!visible || isLoadingNow){
			return
		}
		try {
			await loadNext()
		} finally {
			isLoadingNow = false
		}
	})

	return result
}