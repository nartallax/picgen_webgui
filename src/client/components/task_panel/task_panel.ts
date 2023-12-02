import {ClientApi} from "client/app/client_api"
import {ArrayItemWBox, box} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import * as css from "./task_panel.module.scss"
import {GenerationTaskWithPictures} from "common/entities/generation_task"
import {makeDeletionTimer} from "client/client_common/deletion_timer"
import {TaskPanelFooter} from "client/components/task_panel/task_panel_footer"
import {TaskPanelHeader} from "client/components/task_panel/task_panel_header"
import {makeTaskPanelBody} from "client/components/task_panel/task_panel_body"

interface TaskPanelProps {
	task: ArrayItemWBox<GenerationTaskWithPictures>
}

export function TaskPanel(props: TaskPanelProps): HTMLElement {
	const taskDeletionProgress = box(0)
	const deletionOpacity = taskDeletionProgress.map(x => 1 - x)

	const delTaskNow = async() => {
		const id = props.task.get().id
		props.task.deleteArrayElement()
		await ClientApi.deleteTask(id)
	}

	const delTimer = makeDeletionTimer(500, taskDeletionProgress, delTaskNow)

	const {body, scrollLeftButton, scrollRightButton} = makeTaskPanelBody({
		task: props.task,
		deletionOpacity
	})

	const result = tag({class: [css.taskPanel]}, [
		tag({class: css.body}, [
			TaskPanelHeader({
				task: props.task,
				delTimer
			}),
			body,
			TaskPanelFooter({
				task: props.task,
				deletionOpacity
			})
		]),
		scrollLeftButton,
		scrollRightButton
	])

	return result
}