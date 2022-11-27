import {PictureType} from "common/common_types"

export interface User {
	readonly id: number
	readonly creationTime: number
	avatarUrl: string
	displayName: string
}

export type GenerationTaskParameterValue = number | boolean | string | PictureParameterValue

export interface GenerationTaskInputData {
	prompt: string
	paramSetName: string
	params: {[key: string]: GenerationTaskParameterValue}
}

export interface PictureParameterValue {
	id: number
	mask?: string
}

export const generationTaskStatusList = {
	queued: 1,
	running: 2,
	completed: 3
}

export type GenerationTaskStatus = keyof typeof generationTaskStatusList

export interface GenerationTask extends GenerationTaskInputData {
	readonly id: number
	readonly userId: number
	status: GenerationTaskStatus
	readonly creationTime: number
	startTime: number | null
	finishTime: number | null
	expectedPictures: number | null
	generatedPictures: number
	runOrder: number
}

export interface DbGenerationTask extends Omit<GenerationTask, "params" | "status"> {
	params: string
	status: number
}

export interface Picture {
	readonly id: number
	readonly generationTaskId: number | null
	readonly ownerUserId: number
	readonly creationTime: number
	readonly ext: PictureType
	readonly name: string | null
}

export interface PictureInfo {
	width: number
	height: number
	ext: PictureType
}


export type GenerationTaskWithPictures = GenerationTask & {pictures: Picture[]}