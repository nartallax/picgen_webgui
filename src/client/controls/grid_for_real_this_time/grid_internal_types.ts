import {WBox} from "@nartallax/cardboard"

export interface GridPosition {
	offset: number
}

/** A single box from source data, as well as some of the grid's internal data */
export interface GridDataRow<T> extends GridPosition {
	readonly box: WBox<T>
	readonly element: HTMLElement
}