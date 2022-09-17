import {RBox} from "client/base/box"
import {tag} from "client/base/tag"
import {Picture} from "common/entity_types"

interface TaskPictureOpts {
	picture: RBox<Picture>
}

export function TaskPicture(opts: TaskPictureOpts): HTMLElement {
	return tag({
		tagName: "img",
		// TODO: url duplication
		attrs: {
			alt: "Generated picture",
			src: opts.picture.map(picture => `/api/getPictureData?id=${picture.id}`)
		}
	})
}