import {RBox, WBox, isWBox} from "@nartallax/cardboard"
import {bindBox, tag} from "@nartallax/cardboard-dom"
import * as css from "./tag_list.module.scss"

interface TagListProps {
	values: WBox<string[]> | RBox<readonly string[]>
	onclick?(tagStr: string): void
	center?: boolean
}

export function TagList(props: TagListProps): HTMLElement {
	const result = tag({class: [css.tagList, {
		[css.center!]: !!props.center
	}]})

	bindBox(result, props.values, values => {
		while(result.firstChild){
			result.firstChild.remove()
		}
		for(const tagStr of values){
			const item = tag({class: css.tagItem}, [tagStr])
			if(props.onclick){
				item.addEventListener("click", () => props.onclick!(tagStr))
			}

			const valueBox = props.values
			if(isWBox(valueBox)){
				const cross = tag({
					class: "icon-cancel",
					onClick: () => valueBox.set(valueBox.get().filter(x => x !== tagStr))
				})
				item.appendChild(cross)
				item.classList.add(css.editable!)
			}
			result.appendChild(item)
		}
	})

	return result
}