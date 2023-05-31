import {MRBox, RBox, box, constBoxWrap, unbox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import * as css from "./task_picture.module.scss"
import {Picture} from "common/entities/picture"
import {GenerationTaskWithPictures} from "common/entities/generation_task"
import {loadArgumentsFromPicture} from "client/app/load_arguments"
import {ShowImageViewerProps, showImageViewer} from "client/components/image_viewer/image_viewer"

interface TaskPictureProps {
	picture: RBox<Picture>
	isDisabled?: RBox<boolean>
	onLoad?: () => void
	generationTask?: MRBox<GenerationTaskWithPictures>
	loadAnimation?: boolean
}

export function TaskPicture(props: TaskPictureProps): HTMLElement {
	const url = props.picture.map(picture => ClientApi.getPictureUrl(picture.id, picture.salt))

	const linkButton = tag({class: "icon-link-ext"})
	linkButton.addEventListener("click", e => {
		e.stopPropagation()
		window.open(url(), "_blank")
	})

	const copyButton = tag({class: "icon-docs"})
	copyButton.addEventListener("click", e => {
		e.stopPropagation()
		loadArgumentsFromPicture(props.picture(), unbox(props.generationTask))
	})

	const favAddTime = box(props.picture().favoritesAddTime)
	const favoriteButton = tag({class: [
		css.iconFavorite,
		favAddTime.map(time => time !== null ? "icon-star" : "icon-star-empty")
	]})
	favoriteButton.addEventListener("click", async e => {
		e.stopPropagation()
		const isFavoriteNow = favAddTime() !== null
		favAddTime(isFavoriteNow ? null : 1)
		await ClientApi.setPictureFavorite(props.picture().id, !isFavoriteNow)
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
				requestAnimationFrame(() => {
					// raf is here to prevent opening and then immediately closing the viewer
					// it's some weird interference in events and closing-modal-by-background-click
					openViewer(props.picture, props.generationTask)
				})
			},
			onMousedown: e => {
				if(e.button === 1){
					window.open(url(), "_blank")
				}
			}
		}, [
			tag({class: css.leftColumn}, [favoriteButton]),
			tag({class: [css.iconOpen, "icon-resize-full-alt"]}),
			tag({class: css.rightColumn}, [copyButton, linkButton])
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

function openViewer(picture: MRBox<Picture>, task?: MRBox<GenerationTaskWithPictures>): void {
	let props: ShowImageViewerProps<Picture>
	const commonProps = {
		makeUrl: (picture: Picture) => ClientApi.getPictureUrl(picture.id, picture.salt),
		formatLabel: (img: HTMLImageElement) => `${img.naturalWidth} x ${img.naturalHeight}`,
		panBounds: {x: "centerInPicture", y: "borderToBorder"}
	} satisfies Partial<ShowImageViewerProps<Picture>>
	if(task){
		const pictures = constBoxWrap(task).prop("pictures").map(x => [...x].reverse())
		const pictureIndex = pictures().indexOf(unbox(picture))
		props = {
			...commonProps,
			// makeUrl: picture => `https://dummyimage.com/256x${((picture.id % pictures().length) + 1) * 2}00`,
			imageDescriptions: pictures,
			centerOn: pictureIndex < 0 ? undefined : pictureIndex,
			equalizeByHeight: true
		}
	} else {
		props = {
			...commonProps,
			imageDescriptions: constBoxWrap(picture).map(pic => [pic]),
			centerOn: 0
		}
	}

	showImageViewer(props)
}