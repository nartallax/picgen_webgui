import {onMount, tag} from "@nartallax/cardboard-dom"
import * as css from "./task_panel.module.scss"
import {Icon} from "client/generated/icons"
import {ArrayItemWBox, box, calcBox} from "@nartallax/cardboard"
import {GenerationTaskWithPictures} from "common/entities/generation_task"
import {limitClickRate} from "client/client_common/rate_limit"
import {ClientApi} from "client/app/client_api"
import {DeletionTimer} from "client/client_common/deletion_timer"
import {formatTimeSpan} from "client/client_common/format"
import {queueStatus} from "client/app/global_values"

interface Props {
	task: ArrayItemWBox<GenerationTaskWithPictures>
	delTimer: DeletionTimer
}

export const TaskPanelHeader = (props: Props) => {

	const nowBox = box(Date.now())
	const statusBox = props.task.prop("status")

	const result = tag({class: css.header}, [
		tag({
			class: [
				css.killButton, Icon.cancel, {
					[css.hidden!]: props.task.map(task => task.status === "completed")
				}
			],
			attrs: {title: "Cancel"},
			onClick: limitClickRate(() => {
				void ClientApi.killOwnTask(props.task.get().id)
			})
		}),
		tag({
			class: [
				css.deleteButton, Icon.trashEmpty, {
					[css.hidden!]: props.task.map(task => task.status !== "completed")
				}
			],
			attrs: {title: "Delete (hold shift to delete immediately!)"},
			onMousedown: () => props.delTimer.run(),
			onTouchstart: () => props.delTimer.run(),
			onMouseup: () => props.delTimer.cancel(),
			onTouchend: () => props.delTimer.cancel(),
			onClick: limitClickRate(async e => {
				if(e.shiftKey){
					props.delTimer.completeNow()
				}
			})
		}),
		tag({class: css.status}, [
			calcBox([statusBox, queueStatus], (taskStatus, queueStatus) => {
				const queueStatusStr = (queueStatus === "paused" ? " [GLOBAL PAUSE]" : "")
				switch(taskStatus){
					case "completed": return "Done"
					case "running": return "Running"
					case "lockedForEdit": return "Locked for edit" + queueStatusStr
					case "queued": return "Queued" + queueStatusStr
					case "warmingUp": return "Warming up"
				}
			})
		]),
		tag({class: [css.taskExitCodeError, Icon.warningEmpty, {
			[css.hidden!]: props.task.prop("exitCode").map(code => code === 0)
		}]}, [
			props.task.prop("exitCode").map(code => "Failed! Exit code " + code)
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
			class: [css.repeatButton, Icon.loop, {[css.hidden!]: props.task.map(task => task.status !== "completed")}],
			attrs: {title: "Repeat"},
			onClick: limitClickRate(() => {
				const task = props.task.get()
				void ClientApi.createGenerationTask({
					arguments: task.arguments,
					paramSetName: task.paramSetName
				})
			})
		}),
		tag({class: css.timer}, [calcBox([props.task, nowBox], (task, now) => {
			switch(task.status){
				case "lockedForEdit":
				case "warmingUp":
				case "queued": return ""
				case "completed": {
					if(!task.startTime){
						return "" // did not start, was dropped out of queue
					}
					return formatTimeSpan((task.finishTime || 0) - task.startTime)
				}
				case "running": {
					const timePassed = formatTimeSpan(Math.floor(now / 1000) - (task.startTime || 0))
					const endTime = !task.estimatedDuration ? null : formatTimeSpan(task.estimatedDuration)
					return endTime ? `${timePassed} / ${endTime}` : timePassed
				}
			}
		})])
	])

	onMount(result, () => {
		nowBox.set(Date.now())
		const interval = setInterval(() => {
			const status = statusBox.get()
			if(status === "running" || status === "warmingUp"){
				nowBox.set(Date.now())
			} else if(props.task.get().status === "completed"){
				clearInterval(interval)
			}
		}, 1000)
		return () => clearInterval(interval)
	})

	return result
}