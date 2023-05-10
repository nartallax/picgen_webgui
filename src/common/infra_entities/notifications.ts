import {GenerationTask} from "common/entities/generation_task"
import {Picture} from "common/entities/picture"

export interface ApiNotificationWrap {
	notification: ApiNotification
}

export type ApiNotification = TaskMessageNotification
| TaskExpectedPictureCountKnownNotification
| TaskPromptUpdatedNotification
| TaskGeneratedPictureNotification
| TaskFinishedNotification
| TaskStartedNotification
| TaskCreatedNotification

export interface TaskMessageNotification {
	type: "task_message"
	taskId: number
	messageType: "error" | "info"
	message: string
}

export interface TaskExpectedPictureCountKnownNotification {
	type: "task_expected_picture_count_known"
	taskId: number
	expectedPictureCount: number
}

export interface TaskPromptUpdatedNotification {
	type: "task_prompt_updated"
	taskId: number
	prompt: string
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