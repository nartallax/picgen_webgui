import {RC} from "@nartallax/ribcage"
import {GenerationTaskArgsObject} from "common/entities/arguments"
import type {GenerationTask} from "common/entities/generation_task"

export interface PictureInfo {
	width: number
	height: number
	ext: PictureType
}

const pictureTypeArr = ["gif", "png", "jpg", "webp", "bmp", "tiff", "svg", "psd", "ico", "avif", "heic", "heif"] as const
export type PictureType = RC.Value<typeof PictureType>
export const PictureType = RC.constUnion(pictureTypeArr)

export interface PictureWithEffectiveArgs extends Picture {
	effectiveArgs: GenerationTask["params"]
}
export type Picture = RC.Value<typeof Picture>
export const Picture = RC.struct(RC.structFields({
	ro: {
		id: RC.int(),
		generationTaskId: RC.union([RC.constant(null), RC.int()]),
		ownerUserId: RC.int(),
		creationTime: RC.int(),
		ext: PictureType,
		name: RC.union([RC.constant(null), RC.string()]),
		salt: RC.int(),
		modifiedArguments: RC.union([RC.constant(null), GenerationTaskArgsObject])
	},
	normal: {
		favoritesAddTime: RC.union([RC.constant(null), RC.int()])
	}
}))

export const pictureTypeSet: ReadonlySet<PictureType> = new Set(pictureTypeArr)

export type Point2D = RC.Value<typeof Point2D>
export const Point2D = RC.struct({x: RC.number(), y: RC.number()})
export type Polygon = RC.Value<typeof Polygon>
export const Polygon = RC.array(Point2D)
export type PictureMask = RC.Value<typeof PictureMask>
export const PictureMask = RC.array(Polygon)