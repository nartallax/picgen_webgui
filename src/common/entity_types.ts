import {RC} from "@nartallax/ribcage"
import {PictureType} from "common/common_types"

export interface User {
	readonly id: number
	readonly creationTime: number
	avatarUrl: string
	displayName: string
}

export type PictureParameterValue = RC.Value<typeof PictureParameterValue>
export const PictureParameterValue = RC.struct(RC.structFields({
	normal: {
		id: RC.number()
	},
	opt: {
		mask: RC.string()
	}
}))

export type GenerationTaskParameterValue = RC.Value<typeof GenerationTaskParameterValue>
export const GenerationTaskParameterValue = RC.union([
	RC.string(),
	RC.bool(),
	RC.number(),
	PictureParameterValue
])

export type GenerationTaskInputData = RC.Value<typeof GenerationTaskInputData>
export const GenerationTaskInputData = RC.struct({
	prompt: RC.string(),
	paramSetName: RC.string(),
	params: RC.objectMap(GenerationTaskParameterValue)
})

export enum GenerationTaskStatus {
	queued = 1,
	running = 2,
	completed = 3
}

export type GenerationTask = RC.Value<typeof GenerationTask>
export const GenerationTask = RC.struct(RC.structFields({
	ro: {
		id: RC.number(),
		userId: RC.number(),
		creationTime: RC.number()
	},
	normal: {
		status: RC.constUnion(Object.keys(GenerationTaskStatus) as (keyof typeof GenerationTaskStatus)[]),
		startTime: RC.union([
			RC.number(),
			RC.constant(null)
		]),
		finishTime: RC.union([
			RC.number(),
			RC.constant(null)
		]),
		expectedPictures: RC.union([
			RC.number(),
			RC.constant(null)
		]),
		generatedPictures: RC.number(),
		runOrder: RC.number()
	}
}), {}, GenerationTaskInputData)

export interface DbGenerationTask extends Omit<GenerationTask, "params" | "status"> {
	params: string
	status: GenerationTaskStatus
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