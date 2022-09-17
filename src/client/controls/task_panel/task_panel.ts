import {RBox} from "client/base/box"
import {renderArray, tag} from "client/base/tag"
import {TaskPicture} from "client/controls/task_picture/task_picture"
import {GenerationTaskWithPictures} from "common/entity_types"

interface TaskPanelOptions {
	task: RBox<GenerationTaskWithPictures>
}

export function TaskPanel(opts: TaskPanelOptions): HTMLElement {
	return tag({
		class: "task-panel"
	}, renderArray(
		opts.task.prop("pictures"),
		picture => picture.id,
		picture => TaskPicture({picture})
	))
}