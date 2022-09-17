import {RBox} from "client/base/box"
import {renderArray, tag} from "client/base/tag"
import {TaskPanel} from "client/controls/task_panel/task_panel"
import {GenerationTaskWithPictures} from "common/entity_types"

interface TaskListOptions {
	readonly tasks: RBox<GenerationTaskWithPictures[]>
}

export function TaskList(opts: TaskListOptions): HTMLElement {
	return tag({
		class: "task-list"
	}, renderArray(opts.tasks, task => task.id, task => TaskPanel({task})))
}