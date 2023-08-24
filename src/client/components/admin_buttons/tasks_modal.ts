import {box} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {onAdminTaskUpdate} from "client/app/websocket_listener"
import {fetchToBoxMap} from "client/client_common/fetch_to_box_map"
import {Button} from "client/controls/button/button"
import {Row} from "client/controls/layout/row_col"
import {showModal} from "client/controls/modal_base/modal"
import {Table} from "client/controls/table/table"
import {TextBlock} from "client/controls/text_block/text_block"
import {GenerationTask} from "common/entities/generation_task"

export async function showTasksModal(): Promise<void> {
	const values = box([] as GenerationTask[])
	const getUser = fetchToBoxMap(async(id: number) => {
		const users = await ClientApi.adminListUsers({
			filters: [{a: {field: "id"}, op: "=", b: {value: id}}]
		})
		return users[0]!
	})

	const isQueuePaused = box(false)
	async function refreshPauseState(): Promise<void> {
		isQueuePaused.set(await ClientApi.getIsQueuePaused())
	}
	refreshPauseState()

	const modal = showModal({title: "Tasks", width: ["25rem", "75vw", "100rem"], height: ["25rem", "75vh", null]}, [
		Row({justify: "start", padding: "vertical", gap: true}, [
			TextBlock({text: isQueuePaused.map(isPaused => `Queue is ${isPaused ? "paused" : "running"}`)}),
			Button({
				text: "Pause",
				isDisabled: isQueuePaused,
				onClick: async() => {
					await ClientApi.adminPauseQueue()
					await refreshPauseState()
				}
			}),
			Button({
				text: "Unpause",
				isDisabled: isQueuePaused.map(x => !x),
				onClick: async() => {
					await ClientApi.adminUnpauseQueue()
					await refreshPauseState()
				}
			}),
			Button({
				text: "Kill queued",
				onClick: () => ClientApi.adminKillAllQueuedTasks()
			}),
			Button({
				text: "Kill queued and running",
				onClick: () => ClientApi.adminKillAllQueuedAndRunningTasks()
			})
		]),
		Table<GenerationTask>({
			values,
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
			fetch: ClientApi.adminListTasks
		})
	])

	onAdminTaskUpdate.subscribeUntil(modal.waitClose(), task => {
		const tasks = values.get()
		const taskWithIdIndex = tasks.findIndex(x => x.id === task.id)
		if(taskWithIdIndex < 0){
			return
		}

		values.setElementAtIndex(taskWithIdIndex, task)
	})

}

function getTaskAdminActions(task: GenerationTask): [string, () => void][] {
	const actions: [string, () => void][] = []
	if(task.status === "queued" || task.status === "running"){
		actions.push(["Kill", () => ClientApi.adminKillTask(task.id)])
	}
	return actions
}