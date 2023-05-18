import {WBox, box, viewBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
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
			values: props.values ?? box([] as O[]),
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
				onClick: !onRowClick ? undefined : () => onRowClick(rowBox())
			}, viewBox(() => { // viewBox here because getValue can refer to some external box
				const row = rowBox()
				return props.headers.map(header => {
					return tag([header.getValue(row)])
				})
			}))
		})
	])
}