export function capitalize<T extends string>(x: T): Capitalize<T> {
	return x.substring(0, 1).toUpperCase() + x.substring(1) as Capitalize<T>
}