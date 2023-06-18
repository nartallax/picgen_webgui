import {RC} from "@nartallax/ribcage"
import {JsonFileListArgument} from "common/entities/json_file_list"

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

export function isPictureArgument(x: GenerationTaskArgument): x is PictureArgument {
	// TODO: rewrite to validator
	return typeof(x) === "object" && x !== null && typeof((x as PictureArgument).salt) === "number"
}

export type GenerationTaskArgument = RC.Value<typeof GenerationTaskArgument>
export const GenerationTaskArgument = RC.union([
	RC.string(),
	RC.bool(),
	RC.number(),
	PictureArgument,
	RC.array(JsonFileListArgument)
])

export type GenerationTaskArgsObject = RC.Value<typeof GenerationTaskArgsObject>
export const GenerationTaskArgsObject = RC.objectMap(GenerationTaskArgument)