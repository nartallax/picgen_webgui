import {RBox, box} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import * as css from "./task_picture.module.scss"
import {Picture} from "common/entities/picture"

interface TaskPictureProps {
	picture: RBox<Picture>
	openViewer?: (args: OpenTaskPictureViewerArgs) => void
	isDisabled?: RBox<boolean>
	onLoad?: () => void
	loadAnimation?: boolean
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

	const img = tag({
		tag: "img",
		attrs: {
			alt: "Generated picture",
			src: url
		}
	})

	const isLoaded = box(props.loadAnimation ? false : true)

	const result: HTMLElement = tag({
		class: [css.taskPicture, {
			[css.disabled!]: props.isDisabled,
			[css.loaded!]: isLoaded
		}]
	}, [
		img,
		tag({
			class: css.overlay,
			onClick: () => {
				const openViewer = props.openViewer
				if(openViewer){
					requestAnimationFrame(() => {
						// raf is here to prevent opening and then immediately closing the viewer
						// it's some weird interference in events and closing-modal-by-background-click
						openViewer({url: url(), el: result, picture: props.picture()})
					})
				}
			},
			onMousedown: e => {
				if(e.button === 1){
					window.open(url(), "_blank")
				}
			}
		}, [
			tag([]), // tbd
			!props.openViewer ? null : tag({class: [css.iconOpen, "icon-resize-full-alt"]}),
			tag({class: css.iconLinkWrap}, [linkButton])
		])
	])

	const onLoad = () => {
		img.removeEventListener("load", onLoad)
		if(!props.loadAnimation){
			if(props.onLoad){
				props.onLoad()
			}
		} else {
			isLoaded(true)
			if(props.onLoad){
				setTimeout(() => {
					props.onLoad!()
				}, 200) // to synchronise with animation
			}
		}
	}
	img.addEventListener("load", onLoad)

	return result
}