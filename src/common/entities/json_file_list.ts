import {RC} from "@nartallax/ribcage"

export interface JsonFileListItemDescription extends JsonFileListItemDescriptionFile {
	readonly id: string
}

export interface JsonFileList {
	readonly directory: string
	readonly items: readonly JsonFileListItemDescription[]
}

export type JsonFileListItemDescriptionFile = RC.Value<typeof JsonFileListItemDescriptionFile>
export const JsonFileListItemDescriptionFile = RC.struct(RC.structFields({
	ro: {
		name: RC.string()
	},
	roOpt: {
		triggerWords: RC.roArray(RC.string()),
		images: RC.roArray(RC.string()),
		description: RC.string()
	}
}))

export type JsonFileListArgument = RC.Value<typeof JsonFileListArgument>
export const JsonFileListArgument = RC.roStruct({
	id: RC.string(),
	weight: RC.number()
})