import {GenerationTask} from "common/entities/generation_task"
import {LoraDescription} from "common/entities/lora"
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
| TaskAdminNotification
| TaskEstimatedDurationKnownNotification
| LoraDescriptionUpdateNotification

export interface TaskAdminNotification {
	type: "task_admin_notification"
	task: GenerationTask
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

export interface TaskEstimatedDurationKnownNotification {
	type: "task_estimated_duration_known"
	taskId: number
	estimatedDuration: number
}

export interface LoraDescriptionUpdateNotification {
	type: "lora_description_update"
	newLoraDescriptions: readonly LoraDescription[]
}