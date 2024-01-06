import {RBox} from "@nartallax/cardboard"
import {ClassName, tag} from "@nartallax/cardboard-dom"
import * as css from "./grid.module.scss"
import {RowManager} from "client/controls/grid_for_real_this_time/row_manager"
import {GridDataRow} from "client/controls/grid_for_real_this_time/grid_internal_types"
import {VisibleRowRenderer} from "client/controls/grid_for_real_this_time/visible_row_renderer"

interface Props<T> {
	readonly data: RBox<readonly T[]>
	/** Get the key of a single element.
	 * Key must be unique within one list of children.
	 * No other assumptions about the key are made. */
	readonly getKey: (element: T) => unknown
	// FIXME: maybe it's not great?
	// maybe we should give more flexibility by allowing to manipulate row box
	readonly renderRow: (element: T) => string | HTMLElement
	readonly css?: {
		readonly root?: ClassName
		readonly row?: ClassName
	}
}

export const Grid = <T>(props: Props<T>) => {
	const context = props.data.getArrayContext(props.getKey)
	const rowManager = new RowManager(context)

	const renderRow = (row: GridDataRow<T>): HTMLElement => {
		return tag({
			class: [css.gridRow, props.css?.row]
		}, [row.box.map(element => props.renderRow(element))])
	}

	const rowContainer = tag({
		class: [css.grid, props.css?.root]
	})

	new VisibleRowRenderer(rowContainer, rowManager, renderRow)

	return rowContainer
}