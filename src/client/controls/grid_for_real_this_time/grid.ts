import {MRBox, RBox, WBox} from "@nartallax/cardboard"
import {ClassName, tag} from "@nartallax/cardboard-dom"
import * as css from "./grid.module.scss"
import {GridDataRow, PropKeysThatExtendType} from "client/controls/grid_for_real_this_time/grid_internal_types"

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


interface PropTreeConfig<T>{
	/** Name of property that contains children elements.
	 * Will act as argument for `.prop()` method in box mapping. */
	readonly children: PropKeysThatExtendType<T, readonly T[]>
}

interface ImmutableTreeConfig<T> {
	/** Get array containing children of the row.
	 * null means this row cannot have children.
	 *
	 * It is expected for this function to return a property of an row object, but that's not required.
	 * New array can be created each time in case you don't store children, and only want grid to fetch them. */
	getChildren: (element: T) => (readonly T[]) | null
}

interface MutableTreeConfig<T> extends ImmutableTreeConfig<T> {
	/** Set children of the row, creating a new row object.
	 * This function will be used as reverse-mapper in box mapping.
	 *
	 * Not required to be passed;
	 * if not passed, grid will assume you don't store children (but will store them internally) */
	setChildren?: (element: T, children: readonly T[]) => T
}

interface ImmutableDataProps<T> extends CommonProps<T> {
	readonly data: RBox<readonly T[]>
	readonly renderRow: (element: RBox<T>) => MRBox<string | HTMLElement>
	readonly tree?: ImmutableTreeConfig<T> | PropTreeConfig<T>
}

interface MutableDataProps<T> extends CommonProps<T> {
	readonly data: WBox<readonly T[]>
	readonly renderRow: (element: WBox<T>) => MRBox<string | HTMLElement>
	readonly tree?: MutableTreeConfig<T> | PropTreeConfig<T>
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