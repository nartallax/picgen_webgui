import {RBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import * as css from "./task_picture.module.scss"
import {Picture} from "common/entities/picture"

interface TaskPictureProps {
	picture: RBox<Picture>
}

export function TaskPicture(props: TaskPictureProps): HTMLElement {
	// TODO: url duplication here and in api client
	const url = props.picture.map(picture => ClientApi.getPictureUrl(picture.id, picture.salt))
	return tag({
		class: css.taskPicture,
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