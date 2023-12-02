import {tag} from "@nartallax/cardboard-dom"
import {Row} from "client/controls/layout/row_col"
import * as css from "./task_panel.module.scss"
import {Icon} from "client/generated/icons"
import {limitClickRate} from "client/client_common/rate_limit"
import {loadArguments} from "client/app/load_arguments"
import {NoteBlock} from "client/components/note_block/note_block"
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
	const paramSetOfTask = allKnownParamSets.get().find(x => x.internalName === props.task.get().paramSetName)

	return tag({class: css.footer, style: {opacity: props.deletionOpacity}}, [
		Row([
			tag({class: css.prompt}, [props.task.map(task => {
				if(!paramSetOfTask){
					return "<param set deleted, prompt parameter name unknown>"
				}
				return (task.arguments[paramSetOfTask.primaryParameter.jsonName] + "") ?? ""
			})]),
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
		NoteBlock({
			isEditing: isEditingNote,
			note: props.task.prop("note"),
			save: note => ClientApi.setTaskNote(props.task.get().id, note)
		})
	])
}