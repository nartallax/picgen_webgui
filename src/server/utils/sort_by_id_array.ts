import {IdentifiedEntity} from "server/dao"

export function sortByIdArray<T extends IdentifiedEntity>(ids: readonly number[], item: readonly T[]): T[] {
	const itemMap = new Map(item.map(item => [item.id, item]))
	return ids.map(id => itemMap.get(id)).filter((x): x is T => !!x)
}