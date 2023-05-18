import {RC} from "@nartallax/ribcage"

export type User = RC.Value<typeof User>
export const User = RC.struct(RC.structFields({
	ro: {
		id: RC.int(),
		creationTime: RC.int()
	},
	normal: {
		discordId: RC.string(),
		avatarUrl: RC.string(),
		displayName: RC.string(),
		isAdmin: RC.bool(),
		isAllowed: RC.bool()
	}
}))