import {MRBox, RBox, box, constBoxWrap, unbox, viewBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import * as css from "./task_picture.module.scss"
import {Picture, pictureHasAttachedTask} from "common/entities/picture"
import {GenerationTask, GenerationTaskInputData, GenerationTaskWithPictures} from "common/entities/generation_task"
import {getTaskInputDataFromPicture} from "client/app/load_arguments"
import {ShowImageViewerProps, showImageViewer} from "client/components/image_viewer/image_viewer"
import {loadArguments} from "client/app/load_arguments"
import {showTaskArgsModal} from "client/components/task_args_modal/task_args_modal"

interface TaskPictureProps {
	picture: RBox<Picture>
	isDisabled?: RBox<boolean>
	onLoad?: () => void
	generationTask?: MRBox<GenerationTaskWithPictures>
	loadAnimation?: boolean
}

export function TaskPicture(props: TaskPictureProps): HTMLElement {
	const url = props.picture.map(picture => ClientApi.getPictureUrl(picture.id, picture.salt))

	const linkButton = tag({class: ["icon-link-ext", css.iconLink]})
	linkButton.addEventListener("click", e => {
		e.stopPropagation()
		window.open(url(), "_blank")
	})

	const getPictureArgs = (): GenerationTaskInputData => {
		return getTaskInputDataFromPicture(props.picture(), getTask())
	}

	const haveTask = () => pictureHasAttachedTask(props.picture()) || !!unbox(props.generationTask)

	const getTask = (): GenerationTaskInputData => {
		const pic = props.picture()
		let task: GenerationTask | undefined = unbox(props.generationTask)
		if(pictureHasAttachedTask(pic)){
			task = pic.task
		}
		if(!task){
			throw new Error("No task to take params from")
		}
		return task
	}

	const copyButton = tag({class: ["icon-docs", css.iconCopy]}, [tag(["P"])])
	copyButton.addEventListener("click", e => {
		e.stopPropagation()
		loadArguments(getPictureArgs())
	})

	const copyTaskButton = tag({
		class: ["icon-docs", css.iconCopy],
		style: {
			display: viewBox(() => haveTask() ? "block" : "none")
		}
	}, [tag(["T"])])
	copyTaskButton.addEventListener("click", e => {
		e.stopPropagation()
		loadArguments(getTask())
	})

	const makeShowParamsButton = (isTaskOnly: boolean) => {
		const btn = tag({
			class: [css.iconShowParams],
			style: {
				display: isTaskOnly ? viewBox(() => haveTask() ? "" : "none") : ""
			}
		}, [
			tag({tag: "span", class: css.cornerBracket}, ["<"]),
			tag({tag: "span", class: css.letter}, [isTaskOnly ? "T" : "P"]),
			tag({tag: "span", class: css.cornerBracket}, [">"])
		])
		btn.addEventListener("click", e => {
			e.stopPropagation()
			const args = isTaskOnly ? getTask() : getPictureArgs()
			showTaskArgsModal(args)
		})
		return btn
	}

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
			tag({class: css.topRow}, [
				tag([makeShowParamsButton(true), makeShowParamsButton(false)]),
				tag([copyTaskButton, copyButton])
			]),
			tag({class: css.middleRow}, [
				tag({class: [css.iconOpen, "icon-resize-full-alt"]})
			]),
			tag({class: css.bottomRow}, [favoriteButton, linkButton])
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