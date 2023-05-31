import {MRBox, WBox, box, constBoxWrap, viewBox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./select.module.scss"

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

	const onChange = () => {
		if(!props.isSearchable){
			return
		}

		searchText(input.value)
	}

	const input: HTMLInputElement = tag({
		tag: "input",
		class: css.selectInput,
		attrs: {
			readonly: !props.isSearchable
		},
		onFocus: () => {
			listPosition(getListPosition())
			window.addEventListener("click", handleWindowClick)
			onChange()
		},
		onBlur: () => {
			window.removeEventListener("click", handleWindowClick)
			listPosition(null)
			updateValue()
		},
		onChange: onChange,
		onKeydown: onChange,
		onKeyup: onChange,
		onKeypress: onChange,
		onPaste: onChange
	})

	const getListPosition = () => {
		return input.getBoundingClientRect().left
	}

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
					// a bit of a hack, but whatever
					item.onclick!(new MouseEvent(""))
				}
			}
		}
	})

	const listPosition = box<null | number>(null)
	const selectedItem = box(-1)

	const normalize = (str: string): string => {
		return str.replace(/\s/g, "").toLowerCase()
	}

	const filteredOptions = viewBox(() => {
		const srcText = normalize(searchText())
		if(!srcText){
			return options()
		}
		return options()
			.map(opt => ({
				opt,
				index: normalize(opt.label.toLowerCase()).indexOf(srcText)
			}))
			.filter(pair => pair.index >= 0)
			.sort((a, b) => a.index - b.index)
			.map(pair => pair.opt)
	})

	const listWrap = tag({
		class: [css.dropdown],
		style: {
			maxHeight: (props.listSizeLimit ?? 10) + "em"
		}
	}, filteredOptions.mapArray(
		value => value,
		value => {
			const option = tag({
				class: css.option
			}, [value.prop("label")])
			option.onclick = () => {
				props.value(value().value)
				selectedItem(-1)
				input.blur()
				updateValue()
			}
			return option
		}
	))

	const listPositionWrap = tag({class: css.listPosWrap}, [
		listWrap
	])

	const wrap = tag({
		class: [css.select, {[css.argumentInput!]: props.isArgumentInput}]
	}, [
		input,
		tag({class: [css.dropdownIcon, "icon-down-open", {
			[css.open!]: listPosition.map(pos => pos !== null)
		}]}),
		listPositionWrap
	])

	function updateValue(): void {
		const value = props.value()
		const opts = options()
		const valuePair = options().find(x => x.value === value)
		if(!valuePair){
			if(opts.length > 0){
				props.value(opts[0]!.value)
			}
			// there are some semi-legitimate cases when this could happen
			// for example, when stuff is just being loaded and no value is present yet
			// so, whatever, let's not pollute logs with warnings
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

	const hideTimeoutHandle: ReturnType<typeof setTimeout> | null = null
	whileMounted(wrap, listPosition, position => {
		if(position === null){
			listWrap.style.opacity = "0"
			setTimeout(() => {
				listWrap.style.display = "none"
			}, 150)
		} else {
			if(hideTimeoutHandle !== null){
				clearTimeout(hideTimeoutHandle)
			}
			listPositionWrap.style.left = `-${position}px`
			listPositionWrap.style.paddingLeft = `${position}px`
			listWrap.style.opacity = "0"
			listWrap.style.display = ""
			requestAnimationFrame(() => listWrap.style.opacity = "1")
		}
	})

	return wrap
}