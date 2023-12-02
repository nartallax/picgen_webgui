import {WBox} from "@nartallax/cardboard"
import {bindBox, defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./editable_text_block.module.scss"
import {debounce} from "client/client_common/debounce"

interface Props {
	readonly isEditing: WBox<boolean>
	readonly value: WBox<string>
	readonly save: (value: string) => Promise<void>
}

export const EditableTextBlock = defineControl((props: Props) => {

	const result = tag({
		class: css.editableTextBlock,
		onClick: () => props.isEditing.set(true),
		onKeyup: e => {
			if(e.key === "Escape"){
				props.isEditing.set(false)
			}
		}
	}, [
		props.isEditing.map(isEditing => {
			if(isEditing){
				const input: HTMLTextAreaElement = tag({
					tag: "textarea",
					class: css.editableTextInput,
					onChange: () => props.value.set(input.value),
					onKeyup: () => props.value.set(input.value),
					onBlur: () => props.isEditing.set(false)
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