import {MRBox, RBox, WBox, box, calcBox, constBoxWrap} from "@nartallax/cardboard"
import {bindBox, tag} from "@nartallax/cardboard-dom"
import * as css from "./select.module.scss"
import {makeOverlayItem} from "client/controls/overlay_item/overlay_item"
import {Icon} from "client/generated/icons"

export interface SelectSingleOption<T> {
	readonly value: T
	readonly label: string
}

export interface SelectGroupOption<T>{
	readonly items: readonly SelectSingleOption<T>[]
	readonly label: string
}

export type SelectOption<T> = SelectGroupOption<T> | SelectSingleOption<T>

function isSingleOption<T>(opt: SelectOption<T>): opt is SelectSingleOption<T> {
	return !(opt as SelectGroupOption<T>).items
}

function flattenOptions<T>(opts: readonly SelectOption<T>[]): SelectSingleOption<T>[] {
	const result: SelectSingleOption<T>[] = []
	for(const opt of opts){
		if(isSingleOption(opt)){
			result.push(opt)
		} else {
			result.push(...opt.items)
		}
	}
	return result
}

interface Props<T> {
	value: WBox<T>
	options: MRBox<readonly SelectOption<T>[]>
	listSizeLimit?: number
	isArgumentInput?: boolean
	isSearchable?: boolean
	class?: string
}

export function Select<T>(props: Props<T>): HTMLElement {
	const options = constBoxWrap(props.options)
	const flatOptions = options.map(opts => flattenOptions(opts))

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

	function getSingleItemElements(root: HTMLElement): NodeListOf<HTMLElement> {
		return root.querySelectorAll(`.${css.option}`)
	}

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
			const listLength = getSingleItemElements(listWrap).length
			selectedItem.set((value + listLength) % listLength)
		} else if(e.key === "Enter"){
			if(selectedItem.get() >= 0){
				const item = getSingleItemElements(listWrap)[selectedItem.get()]
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

	function filterSingleOptions(srcText: string, opts: readonly SelectSingleOption<T>[]): SelectSingleOption<T>[] {
		return opts
			.map(opt => ({
				opt,
				index: normalize(opt.label.toLowerCase()).indexOf(srcText)
			}))
			.filter(pair => pair.index >= 0)
			.sort((a, b) => a.index - b.index)
			.map(pair => pair.opt)
	}

	const filteredOptions = calcBox([searchText, options], (searchText, options) => {
		const srcText = normalize(searchText)
		if(!srcText){
			return options
		}
		const singleOptions = filterSingleOptions(srcText, options.filter(isSingleOption))
		const groupOptions = options
			.filter(opt => !isSingleOption(opt))
			.map(opt => {
				const filteredItems = filterSingleOptions(srcText, (opt as SelectGroupOption<T>).items)
				if(filteredItems.length < 1){
					return null
				}
				return {
					...opt,
					items: filteredItems
				}
			})
			.filter(optOrNull => !!optOrNull) as SelectGroupOption<T>[]
		return [...singleOptions, ...groupOptions]
	})

	function renderSingleOption(opt: RBox<SelectSingleOption<T>>): HTMLElement {
		const option = tag({
			class: css.option
		}, [opt.prop("label")])
		option.onclick = () => {
			props.value.set(opt.get().value)
			selectedItem.set(-1)
			input.blur()
			updateValue()
		}
		return option
	}

	const listWrap = tag({
		class: [css.dropdown],
		style: {
			maxHeight: ((props.listSizeLimit ?? 10) * 2) + "em"
		}
	},
	[filteredOptions.mapArray(
		value => value,
		opt => {
			const optValue = opt.get()
			if(isSingleOption(optValue)){
				return renderSingleOption(opt as RBox<SelectSingleOption<T>>)
			}
			return tag({
				class: css.group
			}, [
				tag({class: css.groupLabel}, [opt.prop("label")]),
				(opt as RBox<SelectGroupOption<T>>).prop("items").mapArray(
					value => value,
					renderSingleOption
				)
			])



		})])

	const wrap = tag({
		class: [css.select, {[css.argumentInput!]: props.isArgumentInput}, props.class]
	}, [
		input,
		tag({class: [css.dropdownIcon, Icon.downOpen, {
			[css.open!]: isDropdownVisible
		}]})
	])

	makeOverlayItem({
		referenceElement: input,
		body: listWrap,
		visible: isDropdownVisible,
		referencePosition: "bottomLeft",
		overlayPosition: "topLeft"
	})

	function updateValue(): void {
		const value = props.value.get()
		const opts = flatOptions.get()
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
	bindBox(wrap, flatOptions, updateValue)

	bindBox(wrap, selectedItem, selectedItem => {
		const optEls = getSingleItemElements(listWrap)
		for(let i = 0; i < optEls.length; i++){
			const child = optEls[i]!
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