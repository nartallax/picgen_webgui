import {RC} from "@nartallax/ribcage"
import {RCV} from "@nartallax/ribcage-validation"
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

export const isPictureArgument = RCV.getValidatorBuilder().build(PictureArgument)

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