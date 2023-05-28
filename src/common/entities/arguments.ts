import {RC} from "@nartallax/ribcage"

export type PictureArgument = RC.Value<typeof PictureArgument>
export const PictureArgument = RC.struct(RC.structFields({
	normal: {
		id: RC.number(),
		salt: RC.number()
	},
	opt: {
		mask: RC.string()
	}
}))

export type GenerationTaskArgument = RC.Value<typeof GenerationTaskArgument>
export const GenerationTaskArgument = RC.union([
	RC.string(),
	RC.bool(),
	RC.number(),
	PictureArgument
])

export type GenerationTaskArgsObject = RC.Value<typeof GenerationTaskArgsObject>
export const GenerationTaskArgsObject = RC.objectMap(GenerationTaskArgument)