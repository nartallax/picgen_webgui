import {box} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {queueStatus} from "client/app/global_values"
import {onAdminTaskUpdate} from "client/app/websocket_listener"
import {fetchToBoxMap} from "client/client_common/fetch_to_box_map"
import {Button} from "client/controls/button/button"
import {Row} from "client/controls/layout/row_col"
import {showModal} from "client/controls/modal_base/modal"
import {Table} from "client/controls/table/table"
import {TextBlock} from "client/controls/text_block/text_block"
import {GenerationTask} from "common/entities/generation_task"

export async function showTasksModal(): Promise<void> {
	const tasks = box([] as GenerationTask[])
	const activeTask = tasks.map(tasks => tasks.filter(task => task.status === "running" || task.status === "warmingUp")[0] ?? null)
	const tasksInQueueCount = tasks.map(tasks => tasks.filter(task => task.status === "queued").length)

	const getUser = fetchToBoxMap(async(id: number) => {
		const users = await ClientApi.adminListUsers({
			filters: [{a: {field: "id"}, op: "=", b: {value: id}}]
		})
		return users[0]!
	})

	const isQueuePaused = queueStatus.map(status => status === "paused")

	const modal = showModal({title: "Tasks", width: ["25rem", "75vw", "100rem"], height: ["25rem", "75vh", null]}, [
		Row({justify: "start", padding: "bottom"}, [
			TextBlock({text: queueStatus.map(status => `Queue is ${status}`)})
		]),
		Row({justify: "start", padding: "bottom"}, [
			activeTask.map(task => {
				if(!task){
					return TextBlock({text: "Active task: none"})
				}
				const user = getUser(task.userId)
				return TextBlock({text: user.map(user =>
					`Active task: #${task.id} by ${!user ? "#" + task.userId : user.displayName}`
				)})
			})
		]),
		Row({justify: "start", padding: "bottom"}, [
			TextBlock({text: tasksInQueueCount.map(count => `Tasks in queue: ${count}`)})
		]),
		Row({justify: "start", padding: "bottom", gap: true}, [
			Button({
				text: "Pause",
				isDisabled: isQueuePaused,
				onClick: async() => {
					await ClientApi.adminPauseQueue()
				}
			}),
			Button({
				text: "Unpause",
				isDisabled: isQueuePaused.map(x => !x),
				onClick: async() => {
					await ClientApi.adminUnpauseQueue()
				}
			}),
			Button({
				text: "Kill queued",
				onClick: () => ClientApi.adminKillAllQueuedTasks()
			}),
			Button({
				text: "Kill queued and running",
				onClick: () => ClientApi.adminKillAllQueuedAndRunningTasks()
			}),
			Button({
				text: "Kill current and pause",
				onClick: async() => {
					await ClientApi.adminKillCurrentAndPauseQueue()
				}
			})
		]),
		Table<GenerationTask>({
			values: tasks,
			headers: [{
				label: "ID",
				render: task => task.prop("id"),
				width: "4rem"
			}, {
				label: "User",
				render: task => tag([getUser(task.get().userId).map(user => "#" + task.get().userId + (!user ? "" : ", " + user.displayName))])
			}, {
				label: "Status",
				render: task => task.map(task => `${task.status}, ${task.generatedPictures} / ${task.expectedPictures ?? "???"}`),
				width: "15rem"
			}, {
				label: "Actions",
				render: task => Row({gap: true}, [
					task.map(task => getTaskAdminActions(task).map(([name, action]) => Button({
						text: name,
						onClick: action,
						variant: "small"
					})))
				]),
				width: "10rem"
			}],
			fetch: params => {
				params.sortBy = "runOrder"
				return ClientApi.adminListTasks(params)
			}
		})
	])

	void onAdminTaskUpdate.subscribeUntil(modal.waitClose(), task => {
		const taskArray = tasks.get()
		const taskWithIdIndex = taskArray.findIndex(x => x.id === task.id)
		if(taskWithIdIndex < 0){
			return
		}

		tasks.setElementAtIndex(taskWithIdIndex, task)
	})

}

function getTaskAdminActions(task: GenerationTask): [string, () => void][] {
	const actions: [string, () => void][] = []
	if(task.status === "queued" || task.status === "running" || task.status === "warmingUp"){
		actions.push(["Kill", () => ClientApi.adminKillTask(task.id)])
	}
	return actions
}