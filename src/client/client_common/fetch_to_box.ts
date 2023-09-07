import {RBox, box} from "@nartallax/cardboard"

export function fetchToBox<T>(fetcher: () => Promise<T>): RBox<T | undefined> {
	const b = box<T | undefined>(undefined)

	void(async() => {
		try {
			b.set(await fetcher())
		} catch(e){
			console.error(e)
		}
	})()

	return b
}