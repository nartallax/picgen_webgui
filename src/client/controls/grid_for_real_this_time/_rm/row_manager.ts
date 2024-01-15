// import {ArrayContext, RBox} from "@nartallax/cardboard"
// import {GridDataRow, GridPosition} from "client/controls/grid_for_real_this_time/grid_internal_types"

// /** Storage for rows.
//  * Wraps them into custom objects and supplies them to the rest of the grid.
//  *
//  * Here's the only place where data rows are stored and manipulated
//  * This is because datarows are mutable,
//  * so all parts of the grid need to share the same instance;
//  * this make updating locations easier, because we can update them all in one place */
// export class RowManager<T> {
// 	private readonly row = new WeakMap<RBox<T>, GridDataRow<T>>()
// 	constructor(private readonly context: ArrayContext<T, unknown, RBox<T>>) {
// 	}

// 	getFirst(): GridDataRow<T> | null {
// 		return this.locate({
// 			offset: 0
// 		})
// 	}

// 	getNext(row: GridDataRow<T>): GridDataRow<T> | null {
// 		return this.locate({
// 			offset: row.offset + 1
// 		})
// 	}

// 	getPrevious(row: GridDataRow<T>): GridDataRow<T> | null {
// 		return this.locate({
// 			offset: row.offset - 1
// 		})
// 	}

// 	private locate(position: GridPosition): GridDataRow<T> | null {
// 		const boxes = this.context.getBoxes()
// 		const box = boxes[position.offset]
// 		if(!box){
// 			return null
// 		}

// 		let row = this.row.get(box)
// 		if(!row){
// 			row = {...position, box, element: null}
// 			this.row.set(box, row)
// 		}

// 		return row
// 	}

// }