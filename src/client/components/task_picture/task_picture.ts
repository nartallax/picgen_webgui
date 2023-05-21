import {RBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import * as css from "./task_picture.module.scss"
import {Picture} from "common/entities/picture"

interface TaskPictureProps {
	picture: RBox<Picture>
	openViewer?: (args: OpenTaskPictureViewerArgs) => void
	isDisabled?: RBox<boolean>
}

export type OpenTaskPictureViewerArgs = {picture: Picture, el: HTMLElement, url: string}

export function TaskPicture(props: TaskPictureProps): HTMLElement {
	const url = props.picture.map(picture => ClientApi.getPictureUrl(picture.id, picture.salt))

	const linkButton = tag({
		class: [css.iconLink, "icon-link-ext"]
	})

	linkButton.addEventListener("click", e => {
		e.stopPropagation()
		window.open(url(), "_blank")
	})

	const result: HTMLElement = tag({
		class: [css.taskPicture, {
			[css.disabled!]: props.isDisabled
		}]
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
			onClick: () => props.openViewer && props.openViewer({url: url(), el: result, picture: props.picture()})
		}, [
			tag([]), // tbd
			!props.openViewer ? null : tag({class: [css.iconOpen, "icon-resize-full-alt"]}),
			tag({class: css.iconLinkWrap}, [linkButton])
		])
	])

	return result
}