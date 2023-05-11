import {RC} from "@nartallax/ribcage"
import {Picture, PictureArgument} from "common/entities/picture"

export enum GenerationTaskStatus {
	queued = 1,
	running = 2,
	completed = 3
}

export type GenerationTaskWithPictures = GenerationTask & {pictures: Picture[]}

export type GenerationTaskArgument = RC.Value<typeof GenerationTaskArgument>
export const GenerationTaskArgument = RC.union([
	RC.string(),
	RC.bool(),
	RC.number(),
	PictureArgument
])

export type GenerationTaskInputData = RC.Value<typeof GenerationTaskInputData>
export const GenerationTaskInputData = RC.struct({
	prompt: RC.string(),
	paramSetName: RC.string(),
	params: RC.objectMap(GenerationTaskArgument)
})

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
		hidden: RC.bool()
	}
}), {}, GenerationTaskInputData)