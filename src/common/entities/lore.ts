import {RC} from "@nartallax/ribcage"

export interface Lore {
	readonly id: string
	readonly name: string
	readonly triggerWords?: readonly string[]
}

export type LoreDescriptionFile = RC.Value<typeof LoreDescriptionFile>
export const LoreDescriptionFile = RC.struct(RC.structFields({
	ro: {
		name: RC.string()
	},
	roOpt: {
		triggerWords: RC.roArray(RC.string())
	}
}))

export type LoreArgument = RC.Value<typeof LoreArgument>
export const LoreArgument = RC.roStruct({
	id: RC.string(),
	weight: RC.number()
})