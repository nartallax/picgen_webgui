import {RBox} from "@nartallax/cardboard"
import {ClassName, tag} from "@nartallax/cardboard-dom"
import * as css from "./grid.module.scss"

interface Props<T> {
	readonly data: RBox<readonly T[]>
	/** Get the key of a single element.
	 * Key must be unique within one list of children.
	 * No other assumptions about key are made. */
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
	return tag({
		class: [css.grid, props.css?.root]
	}, [props.data.mapArray(
		props.getKey,
		data => tag({
			class: [css.gridRow, props.css?.row]
		}, [data.map(element => props.renderRow(element))])
	)])
}