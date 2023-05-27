import {RC} from "@nartallax/ribcage"
import {GenerationTask} from "common/entities/generation_task"

export interface Picture {
	readonly id: number
	readonly generationTaskId: number | null
	readonly ownerUserId: number
	readonly creationTime: number
	readonly ext: PictureType
	readonly name: string | null
	readonly salt: number
	readonly modifiedArguments: GenerationTask["params"] | null
}

export interface PictureInfo {
	width: number
	height: number
	ext: PictureType
}

const pictureTypeArr = ["gif", "png", "jpg", "webp", "bmp", "tiff", "svg", "psd", "ico", "avif", "heic", "heif"] as const
export type PictureType = RC.Value<typeof PictureType>
export const PictureType = RC.constUnion(pictureTypeArr)

export const pictureTypeSet: ReadonlySet<PictureType> = new Set(pictureTypeArr)

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

export type Point2D = RC.Value<typeof Point2D>
export const Point2D = RC.struct({x: RC.number(), y: RC.number()})
export type Polygon = RC.Value<typeof Polygon>
export const Polygon = RC.array(Point2D)
export type PictureMask = RC.Value<typeof PictureMask>
export const PictureMask = RC.array(Polygon)