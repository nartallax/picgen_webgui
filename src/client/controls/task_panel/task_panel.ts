import {formatTimeSpan} from "client/client_common/format"
import {getNowBox} from "client/base/now_box"
import {TaskPicture} from "client/controls/task_picture/task_picture"
import {GenerationTaskWithPictures} from "common/entity_types"
import {limitClickRate} from "client/client_common/rate_limit"
import {ClientApi} from "client/app/client_api"
import {RBox, viewBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"

interface TaskPanelProps {
	task: RBox<GenerationTaskWithPictures>
}

export function TaskPanel(props: TaskPanelProps): HTMLElement {
	const nowBox = getNowBox()

	return tag({class: "task-panel"}, [
		tag({class: "task-panel-header"}, [
			tag({class: "task-panel-id"}, [props.task.map(task => "#" + task.id)]),
			tag({class: "task-panel-status"}, [
				props.task.map(task => {
					switch(task.status){
						case "completed": return "Done"
						case "running": return "Running"
						case "queued": return "Queued"
					}
				})
			]),
			tag({class: "task-panel-done-counter"}, [
				props.task.map(task => {
					if(task.generatedPictures < 1 && !task.expectedPictures){
						return ""
					}
					return task.generatedPictures + " / " + (task.expectedPictures === null ? "???" : task.expectedPictures)
				})
			]),
			tag({
				class: ["task-panel-repeat-button", "icon-loop", {hidden: props.task.map(task => task.status !== "completed")}],
				onClick: limitClickRate(() => {
					const task = props.task()
					ClientApi.createGenerationTask({
						params: task.params,
						prompt: task.prompt,
						paramSetName: task.paramSetName
					})
				})
			}),
			tag({
				class: ["task-panel-kill-button", "icon-trash-empty", {hidden: props.task.map(task => task.status === "completed")}],
				onClick: limitClickRate(() => {
					ClientApi.killTask(props.task().id)
				})
			}),
			tag({class: "task-panel-timer"}, [viewBox(() => {
				const task = props.task()
				switch(task.status){
					case "queued": return ""
					case "completed": {
						if(!task.startTime){
							return "" // did not start, was dropped out of queue
						}
						return formatTimeSpan((task.finishTime || 0) - task.startTime)
					}
					case "running": return formatTimeSpan(Math.floor(nowBox() / 1000) - (task.startTime || 0))
				}
			})])
		]),
		tag({class: "task-panel-pictures-wrap"}, [
			tag({class: "task-panel-pictures"}, props.task.prop("pictures").mapArray(
				picture => picture.id,
				picture => TaskPicture({picture})
			))
		]),
		tag({class: "task-panel-footer"}, [
			tag({class: "task-panel-prompt"}, [props.task.map(task => task.prompt)]),
			tag({
				class: ["task-panel-copy-prompt-button", "icon-docs"],
				onClick: limitClickRate(function() {
					navigator.clipboard.writeText(props.task().prompt)
					this.classList.add("task-panel-button-recently-clicked")
					setTimeout(() => {
						this.classList.remove("task-panel-button-recently-clicked")
					}, 500)
				})
			})
		])
	])
}