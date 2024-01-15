import {MRBox, RBox, WBox} from "@nartallax/cardboard"
import {ClassName, tag} from "@nartallax/cardboard-dom"
import * as css from "./grid.module.scss"
import {GridDataRow} from "client/controls/grid_for_real_this_time/grid_internal_types"

interface CommonProps<T>{
	/** Get the key of a single element.
	 * Key must be unique within one list of children, and cannot change.
	 * No other assumptions about keys are made. */
	readonly getKey: (element: T) => unknown
	readonly css?: {
		readonly root?: ClassName
		readonly row?: ClassName
	}
}

interface ImmutableDataProps<T> extends CommonProps<T> {
	readonly data: RBox<readonly T[]>
	readonly renderRow: (element: RBox<T>) => MRBox<string | HTMLElement>
}

interface MutableDataProps<T> extends CommonProps<T> {
	readonly data: WBox<readonly T[]>
	readonly renderRow: (element: WBox<T>) => MRBox<string | HTMLElement>
}

export type GridProps<T> = MutableDataProps<T> | ImmutableDataProps<T>

export const Grid = <T>(srcProps: GridProps<T>) => {
	// we only have type safety on interface level to prevent user from doing obviously wrong things
	// (like describing data-mutating logic while passing immutable data)
	// and also to maintain consistency in what `renderRow` receives with type of `data`
	// but internally it's always treated as mutable, because it's just easier to work with
	const props = srcProps as MutableDataProps<T>

	const renderRow = (box: WBox<T>): HTMLElement => {
		return tag({
			class: [css.gridRow, props.css?.row]
		}, [props.renderRow(box)])
	}

	const rows = props.data.mapArray(props.getKey, box => {
		const result: GridDataRow<T> = {
			box,
			offset: 0,
			element: renderRow(box)
		}
		return result
	})

	const rowContainer = tag({
		class: [css.grid, props.css?.root]
	}, [rows.mapArrayElements(row => row.element)])

	return rowContainer
}