import {box, RBox} from "client/base/box"

export function fetchToBox<T>(fetcher: () => Promise<T>): RBox<T | undefined> {
	const b = box<T | undefined>(undefined);

	(async() => {
		try {
			b(await fetcher())
		} catch(e){
			console.error(e)
		}
	})()

	return b
}