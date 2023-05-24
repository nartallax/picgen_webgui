import {MRBox, WBox, box, constBoxWrap} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./select.module.scss"

interface Props<T> {
	value: WBox<T>
	options: MRBox<readonly {value: T, label: string}[]>
	listSizeLimit?: number
	isArgumentInput?: boolean
}

export function Select<T>(props: Props<T>): HTMLElement {

	const options = constBoxWrap(props.options).map(arr => [...arr, ...arr, ...arr, ...arr, ...arr, ...arr, ...arr, ...arr, ...arr, ...arr, ...arr].map((el, i) => {
		return i === 0 ? el : {
			value: el.value + "" + i,
			label: el.label + i
		}
	}))

	const input: HTMLInputElement = tag({
		tag: "input",
		class: css.selectInput,
		attrs: {
			readonly: true
		},
		onFocus: () => listHidden(false),
		onBlur: () => listHidden(true)
	})

	input.addEventListener("keydown", e => {
		const down = e.key === "ArrowDown"
		const up = e.key === "ArrowUp"
		if(down || up){
			e.preventDefault()
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
				if(item instanceof HTMLElement){
					item.dispatchEvent(new Event("mousedown"))
				}
			}
		}
	})

	const listHidden = box(true)
	const selectedItem = box(-1)

	const listWrap = tag({
		class: [css.dropdown, {
			[css.hidden!]: listHidden
		}],
		style: {
			maxHeight: (props.listSizeLimit ?? 10) + "em"
		}
	}, options.mapArray(
		value => value,
		value => {
			const option = tag({class: css.option}, [value.prop("label")])

			const onItemClick = (e: MouseEvent | TouchEvent) => {
				e.preventDefault()
				e.stopPropagation()
				props.value(value().value)
				selectedItem(-1)
				input.blur()
			}

			// it's not "click", and is capture, because mousedown/touchstart will remove focus from the input
			// and so we need to capture an event before it happens
			option.addEventListener("mousedown", onItemClick, {capture: true})
			option.addEventListener("touchstart", onItemClick, {capture: true})
			return option
		}
	))

	const wrap = tag({
		class: [css.select, {[css.argumentInput!]: props.isArgumentInput}]
	}, [
		input,
		tag({class: [css.dropdownIcon, "icon-down-open", {
			[css.open!]: listHidden.map(hidden => !hidden)
		}]}),
		listWrap
	])

	function updateValue(): void {
		const value = props.value()
		const valuePair = options().find(x => x.value === value)
		if(!valuePair){
			// console.warn("There's no value " + JSON.stringify(value) + " in the list")
			return
		}
		input.value = valuePair.label
	}

	whileMounted(wrap, props.value, updateValue)
	whileMounted(wrap, options, updateValue)

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