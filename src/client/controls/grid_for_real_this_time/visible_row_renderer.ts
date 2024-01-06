import {onMount} from "@nartallax/cardboard-dom"
import {GridDataRow} from "client/controls/grid_for_real_this_time/grid_internal_types"
import {RowManager} from "client/controls/grid_for_real_this_time/row_manager"

/** This class renders rows when they are visible and removes them when they are not */
export class VisibleRowRenderer<T> {

	private currentTopRow: GridDataRow<T> | null = null
	private currentBottomRow: GridDataRow<T> | null = null

	constructor(private readonly container: HTMLElement,
		private readonly rowManager: RowManager<T>,
		private readonly renderRow: (row: GridDataRow<T>) => HTMLElement) {

		const update = this.update.bind(this)

		container.addEventListener("scroll", update, {passive: true})

		onMount(container, () => {
			const resizeObserver = new ResizeObserver(update)
			resizeObserver.observe(container)
			update()
			return () => {
				resizeObserver.unobserve(container)
				resizeObserver.disconnect()
			}
		}, {ifInDom: "call"})
	}

	private update(): void {
		const containerRect = this.container.getBoundingClientRect()
		this.addTopRows(containerRect)
		this.addBottomRows(containerRect)
		this.removeInvisibleTopRows(containerRect)
		this.removeInvisibleBottomRows(containerRect)
	}

	private addFirstRow(): GridDataRow<T> | null {
		const firstRow = this.rowManager.getFirst()
		if(!firstRow){
			return null // no data
		}

		const el = this.renderAndSetRow(firstRow)
		el.style.marginTop = "0px"
		this.container.appendChild(el)
		this.currentTopRow = this.currentBottomRow = firstRow
		return this.currentTopRow
	}

	private addTopRows(containerRect: DOMRect): void {
		this.addRowsUntilBorder(
			this.currentTopRow,
			rect => rect.top > containerRect.top,
			row => this.rowManager.getPrevious(row),
			(oldEl, newEl, newRow) => {
				// adding new top row
				oldEl.before(newEl)
				oldEl.style.marginTop = ""

				// updating the offset
				// wonder if it would cause flickering...
				const newRect = newEl.getBoundingClientRect()
				let offset = parseInt(oldEl.style.marginTop ?? "0")
				offset -= newRect.height
				newEl.style.marginTop = offset + "px"

				this.currentTopRow = newRow

				return newRect
			},
			el => el.style.marginTop = "0px"
		)
	}

	private addBottomRows(containerRect: DOMRect): void {
		this.addRowsUntilBorder(
			this.currentBottomRow,
			rect => rect.bottom < containerRect.bottom,
			row => this.rowManager.getNext(row),
			(oldEl, newEl, newRow) => {
				oldEl.after(newEl)
				this.currentBottomRow = newRow
			}
		)
	}

	private addRowsUntilBorder(
		initialRow: GridDataRow<T> | null,
		shouldAddMore: (currentRect: DOMRect) => boolean,
		getNextRow: (row: GridDataRow<T>) => GridDataRow<T> | null,
		insertElement: (existingEl: HTMLElement, newEl: HTMLElement, newRow: GridDataRow<T>) => DOMRect | void,
		onEndReached?: (el: HTMLElement) => void
	): void {
		let currentRow = initialRow ?? this.addFirstRow()
		if(!currentRow){
			// empty grid
			return
		}

		let el = currentRow.element
		if(!el){
			throw new Error("Row doesn't have an element, how did this happen?")
		}

		let rect = el.getBoundingClientRect()
		while(shouldAddMore(rect)){
			const nextRow = getNextRow(currentRow)
			if(!nextRow){
				if(onEndReached){
					onEndReached(el)
				}
				return
			}

			const nextEl = this.renderAndSetRow(nextRow)
			const newRect = insertElement(el, nextEl, nextRow)
			rect = newRect ?? nextEl.getBoundingClientRect()
			el = nextEl
			currentRow = nextRow
		}
	}

	private renderAndSetRow(row: GridDataRow<T>): HTMLElement {
		if(row.element){
			throw new Error("Cannot render row - it's already rendered")
		}
		row.element = this.renderRow(row)
		return row.element
	}

	private removeInvisibleBottomRows(containerRect: DOMRect): void {
		this.removeInvisibleRows(
			containerRect,
			this.currentBottomRow,
			row => {
				const next = this.rowManager.getPrevious(row)
				this.currentBottomRow = next
				return next
			}
		)
	}

	private removeInvisibleTopRows(containerRect: DOMRect): void {
		this.removeInvisibleRows(
			containerRect,
			this.currentTopRow,
			(row, el, rect) => {
				const next = this.rowManager.getNext(row)
				if(next && next.element){
					let offset = parseInt(el.style.marginTop ?? "0")
					offset += rect.height
					next.element.style.marginTop = offset + "px"
				}
				this.currentTopRow = next
				return next
			}
		)
	}

	private removeInvisibleRows(
		containerRect: DOMRect,
		row: GridDataRow<T> | null,
		handleRemoveAndGetNext: (row: GridDataRow<T>, el: HTMLElement, rect: DOMRect) => GridDataRow<T> | null
	): void {
		if(!row){
			// no data
			return
		}

		let el = row.element
		if(!el){
			throw new Error("Row has no element")
		}

		let rect = el.getBoundingClientRect()
		while(rect.top > containerRect.bottom || rect.bottom < containerRect.top){
			const next = handleRemoveAndGetNext(row, el, rect)
			el.remove()

			if(!next || !next.element){
				return // weird, but whatever
			}

			el = next.element
			row = next
			rect = el.getBoundingClientRect()
		}
	}

}