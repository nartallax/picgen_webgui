import {getBinder} from "client/base/binder/binder"
import {box, RBox, viewBox, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {PrefixTree} from "client/data_structure/prefix_tree"

interface SelectSearchOptions {
	availableValues: RBox<(readonly string[]) | null>
	value: WBox<string>
	listSizeLimit: number
}

export function SelectSearch(opts: SelectSearchOptions): HTMLElement {

	const input: HTMLInputElement = tag({
		tagName: "input",
		class: "select-search-input",
		on: {
			input: () => {
				opts.value(input.value)
				selectedItem(-1)
			},
			focus: () => listHidden(false),
			blur: () => listHidden(true),
			keydown: e => {
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
							opts.value(item.textContent + "")
							input.blur()
						}
					}
				}

			}
		}
	})

	const listHidden = box(true)
	const selectedItem = box(-1)

	const listWrap = tag({
		class: ["select-search-dropdown", {
			hidden: listHidden
		}]
	})

	const wrap = tag({
		class: "select-search"
	}, [
		tag({class: ["select-search-left-icon icon-picture"]}),
		input,
		tag({class: ["select-search-right-icon", "icon-down-open", {
			open: viewBox(() => !listHidden())
		}]}),
		listWrap
	])

	const prefixTree = viewBox(() => {
		const srcData = opts.availableValues()
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
		opts.value(this.textContent + "")
		input.blur()
	}

	const binder = getBinder(wrap)
	binder.watchAndRun(opts.value, searchStr => {
		if(input.value !== searchStr){
			input.value = searchStr
		}

		while(listWrap.firstChild){
			listWrap.firstChild.remove()
		}

		let selectedItems: Iterable<string>
		if(searchStr === ""){
			selectedItems = (opts.availableValues() || []).slice(0, opts.listSizeLimit)
		} else {
			selectedItems = prefixTree().getAllValuesWhichKeysInclude(searchStr.toLowerCase(), undefined, opts.listSizeLimit)
		}
		for(const item of selectedItems){
			const itemEl = tag({
				class: "select-search-item",
				text: item
			})
			itemEl.addEventListener("mousedown", onItemClick, {capture: true})
			listWrap.appendChild(itemEl)
		}
	})

	const selectedItemClass = "select-search-selected-item"
	binder.watchAndRun(selectedItem, selectedItem => {
		for(let i = 0; i < listWrap.children.length; i++){
			const child = listWrap.children[i]!
			const hasClass = child.classList.contains(selectedItemClass)
			if(i === selectedItem){
				if(!hasClass){
					child.classList.add(selectedItemClass)
				}
			} else if(hasClass){
				child.classList.remove(selectedItemClass)
			}
		}
	})

	return wrap
}