import {ClientApi} from "client/app/client_api"
import {RBox} from "client/base/box"
import {tag} from "client/base/tag"
import {Picture} from "common/entity_types"

interface TaskPictureOpts {
	picture: RBox<Picture>
}

export function TaskPicture(opts: TaskPictureOpts): HTMLElement {
	// TODO: url duplication here and in api client
	const url = opts.picture.map(picture => ClientApi.getPictureUrl(picture.id))
	return tag({
		class: "task-picture",
		tagName: "a",
		attrs: {href: url, target: "blank"}
	}, [
		tag({
			tagName: "img",
			attrs: {
				alt: "Generated picture",
				src: url
			}
		})
	])
}