import {WBox} from "@nartallax/cardboard"

export interface GridPosition {
	offset: number
}

export type PropKeysThatExtendType<BaseObject, PropType, Key extends keyof BaseObject = keyof BaseObject> =
	Key extends keyof BaseObject // just for distributiveness
		? BaseObject[Key] extends PropType
			? Key
			: never
		: never

/** A single box from source data, as well as some of the grid's internal data */
export interface GridDataRow<T> extends GridPosition {
	readonly box: WBox<T>
	readonly children: WBox<readonly T[]> | null
	readonly element: HTMLElement
}