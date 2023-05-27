import {WBox, box} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {VisibilityNotifier} from "client/controls/visibility_notifier/visibility_notifier"
import * as css from "./feed.module.scss"
import {IdentifiedEntity} from "server/dao"
import {BinaryQueryCondition, SimpleListQueryParams} from "common/infra_entities/query"

interface FeedProps<T> {
	values: WBox<T[]>
	loadNext: (currentValues: T[]) => T[] | Promise<T[]>
	getId: (value: T) => string | number
	renderElement: (value: WBox<T>) => HTMLElement
	bottomLoadingPlaceholder?: HTMLElement
	class?: string
}

export function Feed<T>(props: FeedProps<T>): HTMLElement {
	const isBottomVisible = box(false)
	const reachedEndOfFeed = box(false)
	let isLoadingNow = false
	const bottomPlaceholder = props.bottomLoadingPlaceholder ?? tag(["Loading..."])

	const result = tag({class: [css.feed, props.class]}, [
		tag({
			class: css.feedItemsContainer
		}, props.values.mapArray(props.getId, props.renderElement)),
		VisibilityNotifier({
			isOnScreen: isBottomVisible,
			hide: reachedEndOfFeed
		}, [bottomPlaceholder])
	])

	async function loadNext(): Promise<void> {
		let currentValues = props.values()
		// console.log("Loading next, starting with " + currentValues.length)
		const newValues = await Promise.resolve(props.loadNext(currentValues))
		currentValues = [...currentValues, ...newValues]
		props.values(currentValues)
		reachedEndOfFeed(newValues.length === 0)
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
		if(!isBottomVisible() || isLoadingNow || reachedEndOfFeed()){
			return
		}
		isLoadingNow = true
		try {
			await loadNext()
		} finally {
			isLoadingNow = false
		}
	}

	whileMounted(result, isBottomVisible, tryLoadNext)
	whileMounted(result, reachedEndOfFeed, tryLoadNext)
	whileMounted(result, props.values, () => reachedEndOfFeed(false))

	return result
}


type SimpleFeedFetcherParams<T extends Record<string, unknown> & IdentifiedEntity, O = T> = {
	sortBy?: keyof T & string
	fetch: (query: SimpleListQueryParams<T>) => Promise<O[]>
	desc?: boolean
	packSize?: number
}

export function makeSimpleFeedFetcher<T extends Record<string, unknown> & IdentifiedEntity, O extends Record<string, unknown> & IdentifiedEntity = T>(params: SimpleFeedFetcherParams<T, O>): (loadedValues: O[]) => Promise<O[]> {
	return loadedValues => {
		const lastEntry = loadedValues[loadedValues.length - 1]
		const filters: BinaryQueryCondition<T>[] = []
		if(lastEntry){
			filters.push({
				a: {field: "id"},
				op: "<",
				b: {value: lastEntry.id}
			})
		}
		return params.fetch({
			sortBy: params.sortBy ?? "id",
			desc: params.desc ?? true,
			limit: params.packSize || 10,
			filters
		})
	}
}