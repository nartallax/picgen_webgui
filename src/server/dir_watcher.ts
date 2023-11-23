import {debounce} from "client/client_common/debounce"
import watch from "node-watch"

export function watchDirectory(path: string, filter: RegExp, handler: () => void): ReturnType<typeof watch> {
	return watch(
		path,
		{filter: filter, recursive: false, delay: 1000, persistent: false},
		// it should be debounced on its own, but for some reason is not
		debounce(1000, handler)
	)
}