import {getBinder} from "client/base/binder/binder"
import {RBox, WBox} from "client/base/box"
import {tag} from "client/base/tag"

interface TagListOptions {
	values: RBox<readonly string[]> | WBox<string[]>
	onclick?(tagStr: string): void
}

export function TagList(opts: TagListOptions): HTMLElement {
	const result = tag({class: "tag-list"})

	const binder = getBinder(result)
	binder.watch(opts.values, values => {
		while(result.firstChild){
			result.firstChild.remove()
		}
		for(const tagStr of values){
			result.appendChild(tag({
				class: "tag-item",
				text: tagStr,
				on: {
					click: () => opts.onclick && opts.onclick(tagStr)
				}
			}))
		}
	})

	return result
}