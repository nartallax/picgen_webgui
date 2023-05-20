import {RBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import * as css from "./task_picture.module.scss"
import {Picture} from "common/entities/picture"
import {showPictureModal} from "client/components/task_picture/task_picture_modal"

interface TaskPictureProps {
	picture: RBox<Picture>
}

export function TaskPicture(props: TaskPictureProps): HTMLElement {
	const url = props.picture.map(picture => ClientApi.getPictureUrl(picture.id, picture.salt))

	const linkButton = tag({
		class: [css.iconLink, "icon-link-ext"]
	})

	linkButton.addEventListener("click", e => {
		e.stopPropagation()
		window.open(url(), "_blank")
	})

	return tag({
		class: css.taskPicture
	}, [
		tag({
			tag: "img",
			attrs: {
				alt: "Generated picture",
				src: url
			}
		}),
		tag({
			class: css.overlay,
			onClick: () => showPictureModal(url())
		}, [
			tag([]), // tbd
			tag({class: [css.iconOpen, "icon-resize-full-alt"]}),
			tag({class: css.iconLinkWrap}, [linkButton])
		])
	])
}