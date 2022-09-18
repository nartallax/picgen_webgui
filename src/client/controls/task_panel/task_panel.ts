import {formatTimeSpan} from "client/client_common/format"
import {RBox, viewBox} from "client/base/box"
import {getNowBox} from "client/base/now_box"
import {renderArray, tag} from "client/base/tag"
import {TaskPicture} from "client/controls/task_picture/task_picture"
import {GenerationTaskWithPictures} from "common/entity_types"
import {limitClickRate} from "client/client_common/rate_limit"
import {ClientApi} from "client/app/client_api"

interface TaskPanelOptions {
	task: RBox<GenerationTaskWithPictures>
}

export function TaskPanel(opts: TaskPanelOptions): HTMLElement {
	const nowBox = getNowBox()

	return tag({class: "task-panel"}, [
		tag({class: "task-panel-header"}, [
			tag({class: "task-panel-id", text: opts.task.map(task => "#" + task.id)}),
			tag({class: "task-panel-status", text: opts.task.map(task => {
				switch(task.status){
					case "completed": return "Done"
					case "running": return "Running"
					case "queued": return "Queued"
				}
			})}),
			tag({class: "task-panel-done-counter", text: opts.task.map(task => {
				if(task.generatedPictures < 1 && !task.expectedPictures){
					return ""
				}
				return task.generatedPictures + " / " + (task.expectedPictures === null ? "???" : task.expectedPictures)
			})}),
			tag({
				class: ["task-panel-repeat-button", "icon-loop", {hidden: opts.task.map(task => task.status !== "completed")}],
				on: {click: limitClickRate(() => {
					const task = opts.task()
					ClientApi.createGenerationTask({
						params: task.params,
						prompt: task.prompt
					})
				})}
			}),
			tag({
				class: ["task-panel-kill-button", "icon-trash-empty", {hidden: opts.task.map(task => task.status === "completed")}],
				on: {click: limitClickRate(() => {
					ClientApi.killTask(opts.task().id)
				})}
			}),
			tag({class: "task-panel-timer", text: viewBox(() => {
				const task = opts.task()
				console.log("TIMER UPDATE", task)
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
			})})
		]),
		tag({class: "task-panel-pictures-wrap"}, [
			tag({class: "task-panel-pictures"}, renderArray(
				opts.task.prop("pictures"),
				picture => picture.id,
				picture => TaskPicture({picture})
			))
		]),
		tag({class: "task-panel-footer"}, [
			tag({class: "task-panel-prompt", text: opts.task.map(task => task.prompt)}),
			tag({
				class: ["task-panel-copy-prompt-button", "icon-docs"],
				on: {click: limitClickRate(function() {
					navigator.clipboard.writeText(opts.task().prompt)
					this.classList.add("task-panel-button-recently-clicked")
					setTimeout(() => {
						this.classList.remove("task-panel-button-recently-clicked")
					}, 500)
				})}
			})
		])
	])
}