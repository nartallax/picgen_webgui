import {getBinder} from "client/base/binder/binder"
import {isWBox, RBox, WBox} from "client/base/box"
import {tag} from "client/base/tag"

interface TagListOptions {
	values: WBox<string[]> | RBox<readonly string[]>
	onclick?(tagStr: string): void
	center?: boolean
}

export function TagList(opts: TagListOptions): HTMLElement {
	const result = tag({class: ["tag-list", {
		center: !!opts.center
	}]})

	const binder = getBinder(result)
	binder.watch(opts.values, values => {
		while(result.firstChild){
			result.firstChild.remove()
		}
		for(const tagStr of values){
			const item = tag({
				class: "tag-item",
				text: tagStr
			})
			if(opts.onclick){
				item.addEventListener("click", () => opts.onclick!(tagStr))
			}

			const valueBox = opts.values
			if(isWBox(valueBox)){
				const cross = tag({
					class: ["tag-remove-button", "icon-cancel"],
					on: {click: () => {
						valueBox(valueBox().filter(x => x !== tagStr))
					}}
				})
				item.appendChild(cross)
				item.classList.add("editable")
			}
			result.appendChild(item)
		}
	})

	return result
}