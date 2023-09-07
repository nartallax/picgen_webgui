import {MRBox, RBox, box, calcBox} from "@nartallax/cardboard"
import {GenerationTaskWithPictures} from "common/entities/generation_task"
import * as css from "./feeds.module.scss"
import {bindBox, tag} from "@nartallax/cardboard-dom"
import {normalizeForFts} from "common/utils/normalize_for_fts"
import {Icon} from "client/generated/icons"
import {TaskFeed} from "client/components/feeds/task_feed"
import {ClientApi} from "client/app/client_api"
import {debounce} from "client/client_common/debounce"

interface Props {
	readonly searchText: RBox<string>
}

export const SearchFeed = (props: Props) => {
	const feedItems = box<GenerationTaskWithPictures[]>([])
	const haveLoadedForCurrentText = box(false)
	let lastSearchedText: string | null = null
	let fetchEndWaiter: null | (() => void) = null
	let haveOngoingFetch = false

	// could be more optimal, but whatever
	function getMinKnownId(): number | null {
		const items = feedItems.get()
		if(items.length === 0){
			return null
		}
		return items.map(x => x.id).reduce((a, b) => Math.min(a, b), Number.MAX_SAFE_INTEGER)
	}

	const feedState = calcBox([props.searchText, haveLoadedForCurrentText, feedItems], (text, loadedSomething, items) => {
		if(normalizeForFts(text).length === 0){
			return "noSearch" as const
		} else if(items.length === 0 && loadedSomething){
			return "noItems" as const
		} else {
			return "feed" as const
		}
	})

	const feed = TaskFeed({
		values: feedItems,
		fetch: async query => {
			const text = props.searchText.get()
			lastSearchedText = text
			haveOngoingFetch = true
			try {
				return await ClientApi.searchTasks(text, query.limit ?? 10, getMinKnownId())
			} finally {
				haveLoadedForCurrentText.set(lastSearchedText === props.searchText.get())
				haveOngoingFetch = false
				if(fetchEndWaiter){
					const w = fetchEndWaiter
					fetchEndWaiter = null
					w()
				}
			}
		}
	})

	const result = tag({class: css.searchFeedWrap}, [
		feedState.map(state => {
			switch(state){
				case "noSearch": return EmptySearchState("Search results will be shown here")
				case "noItems": return EmptySearchState(props.searchText.map(text =>
					"Nothing was found for query:\n" + normalizeForFts(text)
				))
				case "feed": return feed
			}
		})
	])

	bindBox(result, props.searchText, text => {
		haveLoadedForCurrentText.set(lastSearchedText === text)
	})

	const refresh = () => {
		requestAnimationFrame(() => {
			feedItems.deleteAllElements()
			haveLoadedForCurrentText.set(false)
		})
	}

	bindBox(result, props.searchText, debounce(500, () => {
		if(lastSearchedText === props.searchText.get()){
			return // helps avoid flashing on switch between search and non-search
		}
		if(!haveOngoingFetch){
			refresh()
		} else {
			fetchEndWaiter = refresh
		}
	}, {resetTimerOnEachCall: true}))

	return result

}

export const EmptySearchState = (text: MRBox<string>) => tag({class: css.searchEmptyState}, [
	tag({class: [css.searchEmptyIcon, Icon.search]}),
	tag({class: css.searchEmptyText}, [text])
])