import {WBox} from "@nartallax/cardboard"

// TODO: this is stub. this could be great if implemented, but not yet.

export interface GridProps<T> {
	readonly columns: readonly GridColumn<T>[]
	readonly showHeaders?: boolean
	readonly data?: GridDataProvider<T>
	// TODO: this can only work for some data providers...? I need to think about this
	// drag-n-drop is great feature to have, but I'm not sure how to better implement that
	readonly onDrag?: (row: T, oldPosition: GridPosition<T>, newPosition: GridPosition<T>) => void
	readonly renderRow?: (row: WBox<T>, params: RowRenderParams<T>) => HTMLElement
}

interface GridPosition<T>{
	readonly parent: T | null
	readonly childIndex: number
}

interface RowRenderParams<T> {
	readonly depth: number
	readonly parent: T | null
}

interface CellRenderParams<T> extends RowRenderParams<T> {
	readonly column: GridColumn<T>
}

interface CallbackRenderedGridColumn<T> {
	renderCell(row: WBox<T>, params: CellRenderParams<T>): HTMLElement | string | null
}

interface FieldGridColumn<T> {
	readonly field: keyof T
}

type GridColumn<T> = {
	readonly label: string
	readonly isSortable?: boolean
	readonly filter?: GridFilter<T, any>
} & (CallbackRenderedGridColumn<T> | FieldGridColumn<T>)

// internally grid should attach itself to a filter
// so filter knows what column it was attached to
/** One instance of a filter.
 * Knows about which column it is attached to, as well about selected filter values. */
interface GridFilter<T, F>{
	render(): HTMLElement
	getColumn(): GridColumn<T>
	serialize(): F
	deserialize(value: F): void
	isActive(): boolean
	// this is for in-memory datasources
	isMatching(row: T, value: F): boolean
}

interface GridRowQueryParams<T> {
	readonly offset: number
	readonly parent: T | null
	readonly ordering: readonly GridColumn<T>[]
}

interface GridRow<T> {
	readonly value: T
	readonly hasChildren: boolean
}

// same with filters, grid should attach itself to data provider
// which allows refresh() to work
// this can be done with base abstract class that has attach method
/** Data provider is a way to interact with data in the grid. */
interface GridDataProvider<T> {
	getRows(params: GridRowQueryParams<T>): GridRow<T>[] | Promise<GridRow<T>[]>
	getKey(rowValue: T): unknown
	refresh(): void
	getFilters(): readonly GridFilter<T, any>[]
	setFilters(filters: GridFilter<T, any>[]): void
}
