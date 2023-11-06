import {WBox} from "@nartallax/cardboard"
import {bindBox, defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./note_block.module.scss"
import {debounce} from "client/client_common/debounce"

interface Props {
	readonly isEditing: WBox<boolean>
	readonly note: WBox<string>
	readonly save: (note: string) => Promise<void>
}

export const NoteBlock = defineControl((props: Props) => {

	const result = tag({
		class: css.noteBlock,
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
					class: css.noteInput,
					onChange: () => props.note.set(input.value),
					onKeyup: () => props.note.set(input.value),
					onBlur: () => props.isEditing.set(false)
				})
				input.value = props.note.get()
				requestAnimationFrame(() => {
					if(input.isConnected){
						input.focus()
					}
				})
				return input
			} else {
				return tag({
					class: [css.noteText, {
						[css.hidden!]: props.note.map(note => !note)
					}]
				}, [props.note])
			}
		})
	])

	let isSaveOngoing = false
	let lastSavedNote = props.note.get()

	const save = async() => {
		const note = props.note.get()
		if(note === lastSavedNote){
			return
		}
		if(isSaveOngoing){
			setTimeout(saveDebounced, 1000)
			return
		}
		isSaveOngoing = true
		try {
			lastSavedNote = note
			await props.save(note)
		} finally {
			isSaveOngoing = false
		}
	}

	const saveDebounced = debounce(500, save)

	bindBox(result, props.note, saveDebounced)
	bindBox(result, props.isEditing, isEditing => {
		if(!isEditing){
			void save()
		}
	})

	return result
})