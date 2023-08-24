import {WBox, box} from "@nartallax/cardboard"
import {bindBox, tag} from "@nartallax/cardboard-dom"
import {VisibilityNotifier} from "client/controls/visibility_notifier/visibility_notifier"
import * as css from "./feed.module.scss"
import {IdentifiedEntity} from "server/dao"
import {BinaryQueryCondition, SimpleListQueryParams} from "common/infra_entities/query"
import {SoftValueChanger} from "client/base/soft_value_changer"
import {makeOverlayItem} from "client/controls/overlay_item/overlay_item"

interface FeedProps<T> {
	values?: WBox<T[]>
	loadNext: (currentValues: T[]) => T[] | Promise<T[]>
	getId: (value: T) => string | number
	renderElement: (value: WBox<T>) => HTMLElement
	bottomLoadingPlaceholder?: HTMLElement
	class?: string
	containerClass?: string
	scrollToTopButton?: boolean
}

// TODO: control?
export function Feed<T>(props: FeedProps<T>): HTMLElement {
	const values = props.values ?? box([])
	const isBottomVisible = box(false)
	const reachedEndOfFeed = box(false)
	let isLoadingNow = false
	const bottomPlaceholder = props.bottomLoadingPlaceholder ?? tag(["Loading..."])

	const scrollToTopVisible = box(false)

	const result = tag({
		class: [css.feed, props.class],
		onScroll: () => {
			scrollToTopVisible.set(result.scrollTop >= 100)
		}
	}, [
		tag({
			class: [css.feedItemsContainer, props.containerClass]
		}, [values.mapArray(props.getId, props.renderElement)]),
		VisibilityNotifier({
			isOnScreen: isBottomVisible,
			hide: reachedEndOfFeed
		}, [bottomPlaceholder])
	])

	const scroller = new SoftValueChanger({
		timeMs: 250,
		getValue: () => result.scrollTop,
		setValue: v => result.scrollTop = v
	})

	if(props.scrollToTopButton){
		makeOverlayItem({
			body: tag({
				class: [css.scrollToTopButton, "icon-up-open"],
				onClick: () => {
					scroller.set(0)
				}
			}),
			referenceElement: result,
			visible: scrollToTopVisible,
			overlayPosition: "bottomRight",
			referencePosition: "bottomRight"
		})
	}

	async function loadNext(): Promise<void> {
		// console.log("Loading next, starting with " + currentValues.length)
		const newValues = await Promise.resolve(props.loadNext(values.get()))
		values.appendElements(newValues)
		reachedEndOfFeed.set(newValues.length === 0)
		// if(reachedEndOfFeed()){
		// 	console.log("Reached end of feed.")
		// }

		requestAnimationFrame(() => {
			// for case when loading new values didn't hide the placeholder
			// in that case isBottomVisible() will stay true without change
			tryLoadNext()
		})
	}

	async function tryLoadNext() {
		if(!isBottomVisible.get() || isLoadingNow || reachedEndOfFeed.get()){
			return
		}
		isLoadingNow = true
		try {
			await loadNext()
		} finally {
			isLoadingNow = false
		}
	}

	bindBox(result, isBottomVisible, tryLoadNext)
	bindBox(result, reachedEndOfFeed, tryLoadNext)
	// TODO: uhhh what?
	bindBox(result, values, () => reachedEndOfFeed.set(false))

	return result
}


type SimpleFeedFetcherParams<T extends Record<string, unknown> & IdentifiedEntity, O = T> = {
	sortBy?: keyof T & string
	fetch: (query: SimpleListQueryParams<T>) => Promise<O[]>
	desc?: boolean
	packSize?: number
}

export function makeSimpleFeedFetcher<T extends Record<string, unknown> & IdentifiedEntity, O extends Record<string, unknown> & IdentifiedEntity = T>(params: SimpleFeedFetcherParams<T, O>): (loadedValues: O[]) => Promise<O[]> {
	const sortBy = params.sortBy ?? "id"
	return loadedValues => {
		const lastEntry = loadedValues[loadedValues.length - 1]
		const filters: BinaryQueryCondition<T>[] = []
		if(lastEntry){
			filters.push({
				a: {field: sortBy},
				op: "<",
				b: {value: lastEntry.id}
			})
		}
		return params.fetch({
			sortBy: sortBy,
			desc: params.desc ?? true,
			limit: params.packSize || 10,
			filters
		})
	}
}