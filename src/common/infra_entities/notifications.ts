import {GenerationTaskArgument} from "common/entities/arguments"
import {GenerationTask} from "common/entities/generation_task"
import {JsonFileListItemDescription} from "common/entities/json_file_list"
import {Picture} from "common/entities/picture"

export interface ApiNotificationWrap {
	notification: ApiNotification
}

export type ApiNotification = TaskMessageNotification
| TaskExpectedPictureCountKnownNotification
| TaskArgumentUpdatedNotification
| TaskGeneratedPictureNotification
| TaskFinishedNotification
| TaskStartedNotification
| TaskCreatedNotification
| TaskAdminNotification
| TaskEstimatedDurationKnownNotification
| JsonFileListUpdateNotification
| TaskReorderingNotification

export interface TaskAdminNotification {
	type: "task_admin_notification"
	task: GenerationTask
}

export interface TaskReorderingNotification {
	type: "task_reordering"
	orderPairs: {id: number, runOrder: number}[]
}

export interface TaskMessageNotification {
	type: "task_message"
	taskId: number
	messageType: "error" | "info"
	message: string
	displayFor: number | null
}

export interface TaskExpectedPictureCountKnownNotification {
	type: "task_expected_picture_count_known"
	taskId: number
	expectedPictureCount: number
}

export interface TaskArgumentUpdatedNotification {
	type: "task_arguments_updated"
	taskId: number
	args: Record<string, GenerationTaskArgument>
}

export interface TaskGeneratedPictureNotification {
	type: "task_generated_picture"
	taskId: number
	picture: Picture
	generatedPictures: number
}

export interface TaskFinishedNotification {
	type: "task_finished"
	taskId: number
	finishTime: number
	exitCode: number
}

export interface TaskStartedNotification {
	type: "task_started"
	taskId: number
	startTime: number
}

export interface TaskCreatedNotification {
	type: "task_created"
	task: GenerationTask
}

export interface TaskEstimatedDurationKnownNotification {
	type: "task_estimated_duration_known"
	taskId: number
	estimatedDuration: number
}

export interface JsonFileListUpdateNotification {
	type: "json_file_list_update"
	directory: string
	items: readonly JsonFileListItemDescription[]
}