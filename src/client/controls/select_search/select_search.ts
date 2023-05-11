import {RBox, WBox, box} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {PrefixTree} from "client/data_structure/prefix_tree"
import * as css from "./select_search.module.scss"

interface SelectSearchProps {
	availableValues: RBox<(readonly string[]) | null>
	value: WBox<string | null>
	listSizeLimit: number
}

export function SelectSearch(props: SelectSearchProps): HTMLElement {

	const input: HTMLInputElement = tag({
		tag: "input",
		class: css.searchInput,
		onInput: () => {
			props.value(input.value)
			selectedItem(-1)
		},
		onFocus: () => listHidden(false),
		onBlur: () => listHidden(true),
		onKeydown: e => {
			const down = e.key === "ArrowDown"
			const up = e.key === "ArrowUp"
			if(down || up){
				let value = selectedItem()
				if(down){
					value++
				} else if(up){
					value--
				}
				const listLength = listWrap.children.length
				selectedItem((value + listLength) % listLength)
			} else if(e.key === "Enter"){
				if(selectedItem() >= 0){
					const item = listWrap.children[selectedItem()]
					if(item){
						props.value(item.textContent + "")
						input.blur()
					}
				}
			}

		}
	})

	const listHidden = box(true)
	const selectedItem = box(-1)

	const listWrap = tag({
		class: [css.dropdown, {
			[css.hidden!]: listHidden
		}]
	})

	const wrap = tag({
		class: css.selectSearch
	}, [
		tag({class: [css.leftIcon, "icon-picture"]}),
		input,
		tag({class: [css.rightIcon, "icon-down-open", {
			[css.open!]: listHidden.map(hidden => !hidden)
		}]}),
		listWrap
	])

	const prefixTree = props.availableValues.map(srcData => {
		if(!srcData){
			return new PrefixTree<string>([])
		}

		const processedData: [string, string[]][] = srcData.map(x => [x, [x.toLowerCase()]])
		return new PrefixTree<string>(processedData)
	})

	function onItemClick(this: HTMLElement, e: MouseEvent): void {
		console.log("click")
		e.preventDefault()
		e.stopPropagation()
		props.value(this.textContent + "")
		input.blur()
	}

	whileMounted(wrap, props.value, searchStr => {
		if(input.value !== searchStr){
			input.value = searchStr ?? ""
		}

		while(listWrap.firstChild){
			listWrap.firstChild.remove()
		}

		let selectedItems: Iterable<string>
		if(searchStr === "" || searchStr === null){
			selectedItems = (props.availableValues() || []).slice(0, props.listSizeLimit)
		} else {
			selectedItems = prefixTree().getAllValuesWhichKeysInclude(searchStr.toLowerCase(), undefined, props.listSizeLimit)
		}
		for(const item of selectedItems){
			const itemEl = tag({class: css.item}, [item])
			itemEl.addEventListener("mousedown", onItemClick, {capture: true})
			listWrap.appendChild(itemEl)
		}
	})

	whileMounted(wrap, selectedItem, selectedItem => {
		for(let i = 0; i < listWrap.children.length; i++){
			const child = listWrap.children[i]!
			const hasClass = child.classList.contains(css.selectedItem!)
			if(i === selectedItem){
				if(!hasClass){
					child.classList.add(css.selectedItem!)
				}
			} else if(hasClass){
				child.classList.remove(css.selectedItem!)
			}
		}
	})

	return wrap
}