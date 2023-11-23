import {WBox, box} from "@nartallax/cardboard"
import {bindBox, onMount, tag} from "@nartallax/cardboard-dom"
import * as css from "./grid.module.scss"

void box, bindBox, onMount

interface RowSequenceProps<T, K> {
	readonly rows: WBox<readonly T[]>
	readonly getKey: (row: T) => K
	readonly renderRow: (row: WBox<T>) => HTMLElement
	// true means there are more rows, false means there's no more rows
	readonly loadMoreRows?: () => Promise<boolean>
}

/** Test cases:
 * It loads data
 * It won't attempt to load data if there's no data loading function
 * It does not lose scroll when whole grid is refreshed
 * It properly manages scroll when previous rows were added/deleted and rows storage was/was not refreshed */

export const RowSequence = <T, K>(props: RowSequenceProps<T, K>): HTMLElement => {
	const loadTrigger = tag({class: css.loadTrigger})
	const container = tag({class: css.rowSequence}, [
		props.rows.mapArray(props.getKey, rowBox => props.renderRow(rowBox)),
		loadTrigger
	])

	// onMount(container, () => {
	// 	const observer = new IntersectionObserver(entries => {
	// 		const hasIntersection = !!entries.find(entry => entry.isIntersecting)
	// 		if(hasIntersection){
	// 			updateRowsOnScreen()
	// 		}
	// 	})

	// 	observer.observe(loadTrigger)

	// 	return () => observer.disconnect()
	// })

	return container
}