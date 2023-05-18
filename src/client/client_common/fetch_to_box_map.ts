import {RBox, box} from "@nartallax/cardboard"

export function fetchToBoxMap<I, T>(fetch: (id: I) => Promise<T>): (id: I) => RBox<T | null> {
	const map = new Map<I, RBox<T | null>>()
	return id => {
		let b = map.get(id)
		if(!b){
			const wb = b = box<T | null>(null)
			map.set(id, b)
			fetch(id).then(
				value => wb(value),
				error => console.error(error)
			)
		}
		return b
	}

}