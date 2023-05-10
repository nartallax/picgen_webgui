import {WBox, box} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {VisibilityNotifier} from "client/controls/visibility_notifier/visibility_notifier"
import * as css from "./feed.module.scss"

interface FeedProps<T> {
	values: WBox<T[]>
	loadNext: (currentValues: T[]) => T[] | Promise<T[]>
	getId: (value: T) => string | number
	renderElement: (value: WBox<T>) => HTMLElement
	bottomLoadingPlaceholder: HTMLElement
}

export function Feed<T>(props: FeedProps<T>): HTMLElement {
	const isBottomVisible = box(false)
	const reachedEndOfFeed = box(false)
	let isLoadingNow = false

	const result = tag({class: css.feed}, [
		tag({
			class: css.feedItemsContainer
		}, props.values.mapArray(props.getId, props.renderElement)),
		VisibilityNotifier({
			isOnScreen: isBottomVisible,
			hide: reachedEndOfFeed
		}, [props.bottomLoadingPlaceholder])
	])

	async function loadNext(): Promise<void> {
		isLoadingNow = true
		let currentValues = props.values()
		console.log("Loading next, starting with " + currentValues.length)
		const newValues = await Promise.resolve(props.loadNext(currentValues))
		reachedEndOfFeed(newValues.length === 0)
		currentValues = [...currentValues, ...newValues]
		props.values(currentValues)
	}

	whileMounted(result, isBottomVisible, async visible => {
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