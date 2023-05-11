import {formatTimeSpan} from "client/client_common/format"
import {getNowBox} from "client/base/now_box"
import {TaskPicture} from "client/controls/task_picture/task_picture"
import {limitClickRate} from "client/client_common/rate_limit"
import {ClientApi} from "client/app/client_api"
import {RBox, WBox, box, viewBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import * as css from "./task_panel.module.scss"
import {GenerationTask, GenerationTaskArgument, GenerationTaskInputData, GenerationTaskWithPictures} from "common/entities/generation_task"
import {allKnownContentTags, allKnownParamSets, allKnownShapeTags, currentArgumentBoxes, currentContentTags, currentParamSetName, currentPrompt, currentShapeTag} from "client/app/global_values"
import {decomposePrompt} from "client/app/prompt_composing"
import {showToast} from "client/controls/toast/toast"

interface TaskPanelProps {
	task: RBox<GenerationTaskWithPictures>
}

export function TaskPanel(props: TaskPanelProps): HTMLElement {
	const nowBox = getNowBox()
	const taskHidden = box(false)

	return tag({class: [css.taskPanel, {[css.hidden!]: taskHidden}]}, [
		tag({class: css.header}, [
			tag({class: css.id}, [props.task.map(task => "#" + task.id)]),
			tag({class: css.status}, [
				props.task.map(task => {
					switch(task.status){
						case "completed": return "Done"
						case "running": return "Running"
						case "queued": return "Queued"
					}
				})
			]),
			tag({class: css.doneCounter}, [
				props.task.map(task => {
					if(task.generatedPictures < 1 && !task.expectedPictures){
						return ""
					}
					return task.generatedPictures + " / " + (task.expectedPictures === null ? "???" : task.expectedPictures)
				})
			]),
			tag({
				class: [css.repeatButton, "icon-loop", {[css.hidden!]: props.task.map(task => task.status !== "completed")}],
				attrs: {title: "Repeat"},
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
				class: [css.killButton, "icon-cancel", {[css.hidden!]: props.task.map(task => task.status === "completed")}],
				attrs: {title: "Cancel"},
				onClick: limitClickRate(() => {
					ClientApi.killTask(props.task().id)
				})
			}),
			tag({
				class: [css.deleteButton, "icon-trash-empty", {[css.hidden!]: props.task.map(task => task.status !== "completed")}],
				attrs: {title: "Delete"},
				onClick: limitClickRate(async() => {
					await ClientApi.hideTask(props.task().id)
					taskHidden(true)
				})
			}),
			tag({class: css.timer}, [viewBox(() => {
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
		tag({class: css.picturesWrap}, [
			tag({class: css.pictures}, props.task.prop("pictures").mapArray(
				picture => picture.id,
				picture => TaskPicture({picture})
			))
		]),
		tag({class: css.footer}, [
			tag({class: css.prompt}, [props.task.map(task => task.prompt)]),
			tag({
				class: [css.useArgumentsButton, "icon-docs"],
				onClick: limitClickRate(function() {
					loadArguments(props.task())
					this.classList.add(css.recentlyClicked!)
					setTimeout(() => {
						this.classList.remove(css.recentlyClicked!)
					}, 500)
				})
			})
		])
	])
}

function loadArguments(task: GenerationTaskInputData): void {
	const paramSet = allKnownParamSets().find(paramSet => paramSet.internalName === task.paramSetName)
	if(!paramSet){
		showToast({
			text: `There's no parameter set ${task.paramSetName} anymore. This task used that parameter set. Cannot load values.`,
			type: "error"
		})
		return
	}


	const prompt = decomposePrompt(task.prompt, allKnownShapeTags() ?? [], Object.keys(allKnownContentTags() ?? {}))

	currentParamSetName(task.paramSetName)
	currentShapeTag(prompt.shape)
	currentPrompt(prompt.body)
	currentContentTags(prompt.content)

	const nonLoadableParamNames: string[] = []
	for(const [key, value] of Object.entries(task.params)){
		const argBox = currentArgumentBoxes[key]
		if(!argBox){
			nonLoadableParamNames.push(key)
		}
		(argBox as WBox<GenerationTaskArgument>)(value)
	}

	if(nonLoadableParamNames.length > 0){
		showToast({
			text: `Some of parameters of the task are now non-existent and wasn't loaded: ${nonLoadableParamNames.join(", ")}`,
			type: "info"
		})
	}

}