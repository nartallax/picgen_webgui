import {RC} from "@nartallax/ribcage"
import {GenerationTaskArgsObject} from "common/entities/arguments"
import type {Picture} from "common/entities/picture"

export enum GenerationTaskStatus {
	queued = 1,
	running = 2,
	completed = 3
}

export type GenerationTaskWithPictures = GenerationTask & {pictures: Picture[]}
export function taskHasPicturesAttached(task: GenerationTask): task is GenerationTaskWithPictures {
	return !!(task as GenerationTaskWithPictures).pictures
}

export type GenerationTaskInputData = RC.Value<typeof GenerationTaskInputData>
export const GenerationTaskInputData = RC.struct(RC.structFields({
	normal: {
		paramSetName: RC.string(),
		arguments: GenerationTaskArgsObject
	}
}))

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
		runOrder: RC.number(),
		exitCode: RC.number(),
		note: RC.string()
	},
	opt: {
		estimatedDuration: RC.number()
	}
}), {}, GenerationTaskInputData)