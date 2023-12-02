import {RBox, WBox, box, constBox} from "@nartallax/cardboard"
import {ClassName, bindBox, defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./editable_text_block.module.scss"
import {debounce} from "client/client_common/debounce"

interface Props {
	readonly isEditing?: WBox<boolean>
	readonly isEditable?: RBox<boolean>
	readonly value: WBox<string>
	readonly save: (value: string) => Promise<void>
	readonly class?: ClassName
}

// this is a hack to prevent blur when text box (or its parents) is moved within DOM
// there should be some kind of API in our DOM manipulation library to do this entirely within this component
export const editableTextBlurLock = box(false)

export const EditableTextBlock = defineControl((props: Props) => {

	const isEditing = props.isEditing ?? box(false)
	const isEditable = props.isEditable ?? constBox(true)

	const result = tag({
		class: [css.editableTextBlock, props.class],
		onClick: () => {
			if(isEditable.get()){
				isEditing.set(true)
			}
		},
		onKeyup: e => {
			if(e.key === "Escape"){
				isEditing.set(false)
			}
		}
	}, [
		isEditing.map(isEditingNow => {
			if(isEditingNow){
				const boxSize = result.getBoundingClientRect()
				const input: HTMLTextAreaElement = tag({
					tag: "textarea",
					style: {
						height: `calc(${boxSize.height}px - 1rem)`
					},
					class: css.editableTextInput,
					onChange: () => props.value.set(input.value),
					onKeyup: () => props.value.set(input.value),
					onBlur: async() => {
						if(editableTextBlurLock.get()){
							await waitConnected(input)
							input.focus()
						} else {
							isEditing.set(false)
						}
					}
				})
				input.value = props.value.get()
				requestAnimationFrame(() => {
					if(input.isConnected){
						input.focus()
					}
				})
				return input
			} else {
				return tag({
					class: [css.editableTextText, {
						[css.hidden!]: props.value.map(value => !value)
					}]
				}, [props.value])
			}
		})
	])

	let isSaveOngoing = false
	let lastSavedValue = props.value.get()

	const save = async() => {
		const value = props.value.get()
		if(value === lastSavedValue){
			return
		}
		if(isSaveOngoing){
			setTimeout(saveDebounced, 1000)
			return
		}
		isSaveOngoing = true
		try {
			lastSavedValue = value
			await props.save(value)
		} catch(e){
			isEditing.set(false)
			throw e
		} finally {
			isSaveOngoing = false
		}
	}

	const saveDebounced = debounce(500, save)

	bindBox(result, props.value, saveDebounced)
	bindBox(result, props.isEditing, isEditing => {
		if(!isEditing){
			void save()
		}
	})

	return result
})

function waitConnected(el: HTMLElement): Promise<void> {
	return new Promise((ok, err) => {
		let remChecks = 100
		const check = () => {
			if(el.isConnected){
				ok()
				return
			}

			remChecks--
			if(remChecks <= 0){
				err(new Error("Timed out waiting for element to be in DOM"))
				return
			}

			requestAnimationFrame(check)
		}

		check()
	})
}