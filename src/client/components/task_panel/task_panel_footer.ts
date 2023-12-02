import {bindBox, onMount, tag} from "@nartallax/cardboard-dom"
import {Row} from "client/controls/layout/row_col"
import * as css from "./task_panel.module.scss"
import {Icon} from "client/generated/icons"
import {limitClickRate} from "client/client_common/rate_limit"
import {loadArguments} from "client/app/load_arguments"
import {EditableTextBlock} from "client/components/editable_text_block/editable_text_block"
import {ClientApi} from "client/app/client_api"
import {ArrayItemWBox, RBox, box} from "@nartallax/cardboard"
import {GenerationTaskWithPictures} from "common/entities/generation_task"
import {allKnownParamSets} from "client/app/global_values"

interface Props {
	task: ArrayItemWBox<GenerationTaskWithPictures>
	deletionOpacity: RBox<number>
}

export const TaskPanelFooter = (props: Props) => {
	const isEditingNote = box(false)
	const isEditingPrompt = box(false)
	const paramSetOfTask = allKnownParamSets.get().find(x => x.internalName === props.task.get().paramSetName)
	const promptJsonName = paramSetOfTask?.primaryParameter.jsonName ?? ""
	const isPromptEditable = props.task
		.prop("status")
		.map(status => (status === "queued" || status === "lockedForEdit") && !!promptJsonName)

	const result = tag({class: css.footer, style: {opacity: props.deletionOpacity}}, [
		Row([
			EditableTextBlock({
				class: css.prompt,
				isEditing: isEditingPrompt,
				isEditable: isPromptEditable,
				value: props.task.prop("arguments").prop(promptJsonName).map(
					rawPrompt => (rawPrompt ?? "") + "",
					prompt => prompt
				),
				save: async prompt => {
					const task = props.task.get()
					await ClientApi.editTaskArguments(task.id, {
						...task.arguments,
						[promptJsonName]: prompt
					})
				}
			}),
			tag({
				class: [css.useArgumentsButton, Icon.docs],
				onClick: limitClickRate(function() {
					loadArguments(props.task.get())
					this.classList.add(css.recentlyClicked!)
					setTimeout(() => {
						this.classList.remove(css.recentlyClicked!)
					}, 500)
				})
			}),
			tag({
				class: [css.addNoteButton, Icon.note],
				onClick: () => {
					isEditingNote.set(!isEditingNote.get())
				}
			})
		]),
		EditableTextBlock({
			isEditing: isEditingNote,
			value: props.task.prop("note"),
			save: note => ClientApi.setTaskNote(props.task.get().id, note)
		})
	])

	let haveLock = false
	let isInDOM = false
	let lockRenewalInterval: ReturnType<typeof setInterval> | null = null

	function updateLockRenewalTimer(): void {
		const shouldHaveInterval = haveLock && isInDOM
		if(shouldHaveInterval && lockRenewalInterval === null){
			lockRenewalInterval = setInterval(async() => {
				try {
					await ClientApi.renewTaskEditLock(props.task.get().id)
				} catch(e){
					isEditingPrompt.set(false)
					throw e
				}
			}, 30 * 1000)
		} else if(!shouldHaveInterval && lockRenewalInterval !== null){
			clearInterval(lockRenewalInterval)
			lockRenewalInterval = null
		}
	}

	bindBox(result, isEditingPrompt, async isEditing => {
		if(isEditing && !haveLock){
			try {
				await ClientApi.acquireTaskEditLock(props.task.get().id)
				haveLock = true
				updateLockRenewalTimer()
			} catch(e){
				isEditingPrompt.set(false)
				throw e
			}
		} else if(!isEditing && haveLock){
			await ClientApi.releaseTaskEditLock(props.task.get().id)
			haveLock = false
			updateLockRenewalTimer()
		}
	})

	onMount(result, () => {
		isInDOM = true
		updateLockRenewalTimer()
		return () => {
			isInDOM = false
			updateLockRenewalTimer()
		}
	})

	return result
}