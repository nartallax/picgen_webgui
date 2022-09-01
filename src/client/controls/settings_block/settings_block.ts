import {getBinder} from "client/base/binder/binder"
import {isRBox, MaybeRBoxed} from "client/base/box"
import {HtmlTaggable, tag, taggableToTag} from "client/base/tag"

export function SettingsBlock(children: MaybeRBoxed<HtmlTaggable[]>): HTMLElement {
	const result = tag({class: "settings-block"})

	function appendChildren(children: HtmlTaggable[]): void {
		while(result.firstChild){
			result.firstChild.remove()
		}
		for(const child of children){
			const el = taggableToTag(child)
			if(el){
				result.appendChild(el)
			}
		}
	}

	if(isRBox(children)){
		const binder = getBinder(result)
		binder.watch(children, appendChildren)
	} else {
		appendChildren(children)
	}

	return result
}