export function flatten<T>(arr: readonly (readonly T[])[]): T[] {
	const result: T[] = []
	for(let i = 0; i < arr.length; i++){
		const subArr = arr[i]!
		for(let j = 0; j < subArr.length; j++){
			result.push(subArr[j]!)
		}
	}
	return result
}