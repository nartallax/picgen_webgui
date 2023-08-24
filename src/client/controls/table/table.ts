import {RBox, WBox} from "@nartallax/cardboard"
import {HTMLChildArray, tag} from "@nartallax/cardboard-dom"
import {Feed, makeSimpleFeedFetcher} from "client/controls/feed/feed"
import {SimpleListQueryParams} from "common/infra_entities/query"
import {IdentifiedEntity} from "server/dao"
import * as css from "./table.module.scss"

type TableHeader<T> = {
	label: string
	width?: string
	render: (row: RBox<T>) => HTMLChildArray[number]
}

type Props<T extends Record<string, unknown> & IdentifiedEntity, O extends Record<string, unknown> & IdentifiedEntity = T> = {
	values?: WBox<O[]>
	fetch: (query: SimpleListQueryParams<T>) => Promise<O[]>
	headers: TableHeader<O>[]
	onRowClick?: (row: O) => void
}

// TODO: maybe unify this with Tree?
// things to consider: infinite scroll, tree-like structure, multiple columns
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
			}, props.headers.map(header => tag([header.render(rowBox)])))
		})
	])
}