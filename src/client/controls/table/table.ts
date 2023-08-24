import {RBox, WBox} from "@nartallax/cardboard"
import {bindBox, tag} from "@nartallax/cardboard-dom"
import {Feed, makeSimpleFeedFetcher} from "client/controls/feed/feed"
import {SimpleListQueryParams} from "common/infra_entities/query"
import {IdentifiedEntity} from "server/dao"
import * as css from "./table.module.scss"

type TableHeader<T> = {
	label: string
	width?: string
	getValue: (row: T) => string | HTMLElement
}

type Props<T extends Record<string, unknown> & IdentifiedEntity, O extends Record<string, unknown> & IdentifiedEntity = T> = {
	values?: WBox<O[]>
	fetch: (query: SimpleListQueryParams<T>) => Promise<O[]>
	headers: TableHeader<O>[]
	onRowClick?: (row: O) => void
}

export function Table<T extends Record<string, unknown> & IdentifiedEntity, O extends Record<string, unknown> & IdentifiedEntity = T>(props: Props<T, O>): HTMLElement {

	const onRowClick = props.onRowClick
	const templateCols = props.headers.map(header => header.width ?? "auto").join(" ")

	return tag({class: css.table}, [
		tag({
			class: css.tableHeaders,
			style: {gridTemplateColumns: templateCols}
		}, props.headers.map(header => tag([header.label]))),
		Feed<O>({
			values: props.values,
			getId: row => row.id,
			loadNext: makeSimpleFeedFetcher<T, O>({
				fetch: props.fetch,
				packSize: 25
			}),
			renderElement: rowBox => tag({
				class: css.tableRow,
				style: {
					gridTemplateColumns: templateCols
				},
				tag: onRowClick ? "button" : "div",
				onClick: !onRowClick ? undefined : () => onRowClick(rowBox.get())
			}, props.headers.map(header => RowCell({render: header.getValue, rowBox})))
		})
	])
}

// TODO: think about it. it's like the third time I have to write something like this
// (also SwitchPanel and RoutePanel)
// maybe I could generalize it somehow..?
const RowCell = <T>(props: {render: (row: T) => string | HTMLElement, rowBox: RBox<T>}) => {
	const result = tag()

	// FIXME: this could be bad. header.getValue could refer to some box, but it won't be bound to
	bindBox(result, props.rowBox, value => result.replaceChildren(props.render(value)))

	return result
}