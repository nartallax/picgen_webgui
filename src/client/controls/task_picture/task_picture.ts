import {RBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {Picture} from "common/entity_types"

interface TaskPictureProps {
	picture: RBox<Picture>
}

export function TaskPicture(props: TaskPictureProps): HTMLElement {
	// TODO: url duplication here and in api client
	const url = props.picture.map(picture => ClientApi.getPictureUrl(picture.id))
	return tag({
		class: "task-picture",
		tag: "a",
		attrs: {href: url, target: "blank"}
	}, [
		tag({
			tag: "img",
			attrs: {
				alt: "Generated picture",
				src: url
			}
		})
	])
}