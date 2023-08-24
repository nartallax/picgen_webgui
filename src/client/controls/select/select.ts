import {MRBox, WBox, box, calcBox, constBoxWrap} from "@nartallax/cardboard"
import {bindBox, containerTag, tag} from "@nartallax/cardboard-dom"
import * as css from "./select.module.scss"
import {makeOverlayItem} from "client/controls/overlay_item/overlay_item"

interface Props<T> {
	value: WBox<T>
	options: MRBox<readonly {value: T, label: string}[]>
	listSizeLimit?: number
	isArgumentInput?: boolean
	isSearchable?: boolean
}

export function Select<T>(props: Props<T>): HTMLElement {
	const options = constBoxWrap(props.options)

	function handleWindowClick(e: MouseEvent): void {
		if(e.target === wrap || ((e.target instanceof Node) && wrap.contains(e.target))){
			return
		}
		// blur doesn't happen on mobile tap on empty space
		input.blur()
	}

	const searchText = box("")
	const isDropdownVisible = box(false)
	const selectedItem = box(-1)

	const onChange = () => {
		if(!props.isSearchable){
			return
		}

		searchText.set(input.value)
	}

	const input: HTMLInputElement = tag({
		tag: "input",
		class: css.selectInput,
		attrs: {
			readonly: !props.isSearchable
		},
		onFocus: () => {
			isDropdownVisible.set(true)
			window.addEventListener("click", handleWindowClick)
			if(props.isSearchable){
				input.value = ""
				onChange()
			}
		},
		onBlur: () => {
			window.removeEventListener("click", handleWindowClick)
			isDropdownVisible.set(false)
			updateValue()
		},
		onChange: onChange,
		onKeydown: e => {
			if(e.key === "Escape"){
				input.blur()
			} else {
				onChange()
			}
		},
		onKeyup: onChange,
		onKeypress: onChange,
		onPaste: onChange
	})

	input.addEventListener("keydown", e => {
		const down = e.key === "ArrowDown"
		const up = e.key === "ArrowUp"
		if(down || up){
			e.preventDefault()
			let value = selectedItem.get()
			if(down){
				value++
			} else if(up){
				value--
			}
			const listLength = listWrap.children.length
			selectedItem.set((value + listLength) % listLength)
		} else if(e.key === "Enter"){
			if(selectedItem.get() >= 0){
				const item = listWrap.children[selectedItem.get()]
				if(item instanceof HTMLElement){
					// a bit of a hack, but whatever
					item.onclick!(new MouseEvent(""))
				}
			}
		}
	})


	const normalize = (str: string): string => {
		return str.replace(/\s/g, "").toLowerCase()
	}

	const filteredOptions = calcBox([searchText, options], (searchText, options) => {
		const srcText = normalize(searchText)
		if(!srcText){
			return options
		}
		return options
			.map(opt => ({
				opt,
				index: normalize(opt.label.toLowerCase()).indexOf(srcText)
			}))
			.filter(pair => pair.index >= 0)
			.sort((a, b) => a.index - b.index)
			.map(pair => pair.opt)
	})

	const listWrap = containerTag({
		class: [css.dropdown],
		style: {
			maxHeight: ((props.listSizeLimit ?? 10) * 2) + "em"
		}
	},
	filteredOptions,
	value => value,
	value => {
		const option = tag({
			class: css.option
		}, [value.prop("label")])
		option.onclick = () => {
			props.value.set(value.get().value)
			selectedItem.set(-1)
			input.blur()
			updateValue()
		}
		return option
	})

	const wrap = tag({
		class: [css.select, {[css.argumentInput!]: props.isArgumentInput}]
	}, [
		input,
		tag({class: [css.dropdownIcon, "icon-down-open", {
			[css.open!]: isDropdownVisible
		}]})
	])

	makeOverlayItem({
		referenceElement: input,
		body: listWrap,
		visible: isDropdownVisible,
		referencePosition: "bottomLeft",
		overlayPosition: "topLeft",
		zIndex: 100
	})

	function updateValue(): void {
		const value = props.value.get()
		const opts = options.get()
		const valuePair = opts.find(x => x.value === value)
		if(!valuePair){
			if(opts.length > 0){
				props.value.set(opts[0]!.value)
			}
			// there are some semi-legitimate cases when this could happen
			// for example, when stuff is just being loaded and no value is present yet
			// so, whatever, let's not pollute logs with warnings
			// console.warn("There's no value " + JSON.stringify(value) + " in the list")
			return
		}
		input.value = valuePair.label
	}

	bindBox(wrap, props.value, updateValue)
	bindBox(wrap, options, updateValue)

	bindBox(wrap, selectedItem, selectedItem => {
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