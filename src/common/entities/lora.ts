import {RC} from "@nartallax/ribcage"

export interface Lora {
	readonly id: string
	readonly name: string
	readonly triggerWords?: readonly string[]
}

export type LoraDescriptionFile = RC.Value<typeof LoraDescriptionFile>
export const LoraDescriptionFile = RC.struct(RC.structFields({
	ro: {
		name: RC.string()
	},
	roOpt: {
		triggerWords: RC.roArray(RC.string())
	}
}))

export type LoraArgument = RC.Value<typeof LoraArgument>
export const LoraArgument = RC.roStruct({
	id: RC.string(),
	weight: RC.number()
})