import {RBox, WBox, isWBox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"

interface TagListProps {
	values: WBox<string[]> | RBox<readonly string[]>
	onclick?(tagStr: string): void
	center?: boolean
}

export function TagList(props: TagListProps): HTMLElement {
	const result = tag({class: ["tag-list", {
		center: !!props.center
	}]})

	whileMounted(result, props.values, values => {
		while(result.firstChild){
			result.firstChild.remove()
		}
		for(const tagStr of values){
			const item = tag({class: "tag-item"}, [tagStr])
			if(props.onclick){
				item.addEventListener("click", () => props.onclick!(tagStr))
			}

			const valueBox = props.values
			if(isWBox(valueBox)){
				const cross = tag({
					class: ["tag-remove-button", "icon-cancel"],
					onClick: () => valueBox(valueBox().filter(x => x !== tagStr))
				})
				item.appendChild(cross)
				item.classList.add("editable")
			}
			result.appendChild(item)
		}
	})

	return result
}