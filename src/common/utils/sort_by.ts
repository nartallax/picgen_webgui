export function sortBy<T>(arr: readonly T[], getField: (value: T) => string | number, desc?: boolean): T[] {
	return [...arr].sort((a, b) => {
		const fa = getField(a)
		const fb = getField(b)
		const res = fa > fb ? 1 : fa < fb ? -1 : 0
		return desc ? -res : res
	})
}