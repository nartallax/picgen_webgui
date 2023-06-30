import {MRBox, RBox, WBox, box, constBoxWrap, unbox, viewBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import * as css from "./task_picture.module.scss"
import {Picture, pictureHasAttachedTask} from "common/entities/picture"
import {GenerationTask, GenerationTaskInputData, GenerationTaskWithPictures} from "common/entities/generation_task"
import {getTaskInputDataFromPicture} from "client/app/load_arguments"
import {ShowImageViewerProps, showImageViewer} from "client/components/image_viewer/image_viewer"
import {loadArguments} from "client/app/load_arguments"
import {showTaskArgsModal} from "client/components/task_args_modal/task_args_modal"
import {ThumbnailProvidingContext} from "client/app/thumbnail_provider"
import notFoundSvg from "../../../../static/not_found.svg"

interface TaskPictureProps {
	picture: RBox<Picture>
	isDisabled?: RBox<boolean>
	onLoad?: () => void
	generationTask?: MRBox<GenerationTaskWithPictures>
	loadAnimation?: boolean
	thumbContext: ThumbnailProvidingContext
	onScroll?: ShowImageViewerProps<unknown>["onScroll"]
}

class TaskPictureContext {
	readonly favAddTime: WBox<number | null>

	constructor(
		readonly picture: RBox<Picture>,
		readonly generationTask?: MRBox<GenerationTaskWithPictures>
	) {
		this.favAddTime = box(picture().favoritesAddTime)
	}

	private getPictureArgs(): GenerationTaskInputData {
		return getTaskInputDataFromPicture(this.picture(), this.getTask())
	}

	private haveTask(): boolean {
		return pictureHasAttachedTask(this.picture()) || !!unbox(this.generationTask)
	}

	private getTask(): GenerationTaskInputData {
		const pic = this.picture()
		let task: GenerationTask | undefined = unbox(this.generationTask)
		if(pictureHasAttachedTask(pic)){
			task = pic.task
		}
		if(!task){
			throw new Error("No task to take params from")
		}
		return task
	}

	makeLinkButton(): HTMLElement {
		const linkButton = tag({class: ["icon-link-ext", css.iconLink]})
		linkButton.addEventListener("click", e => {
			e.stopPropagation()
			const picture = this.picture()
			window.open(ClientApi.getPictureUrl(picture.id, picture.salt), "_blank")
		})
		return linkButton
	}

	makeCopyButton(): HTMLElement {
		const copyButton = tag({class: ["icon-copy-single", css.iconCopy]})
		copyButton.addEventListener("click", e => {
			e.stopPropagation()
			loadArguments(this.getPictureArgs())
		})
		return copyButton
	}

	makeCopyTaskButton(): HTMLElement {
		const copyTaskButton = tag({
			class: ["icon-copy-task", css.iconCopy],
			style: {
				display: viewBox(() => this.haveTask() ? "" : "none")
			}
		})
		copyTaskButton.addEventListener("click", e => {
			e.stopPropagation()
			loadArguments(this.getTask())
		})
		return copyTaskButton
	}

	makeShowParamsButton(isTaskOnly: boolean): HTMLElement {
		const btn = tag({
			class: [css.iconShowParams, `icon-copy-json-${isTaskOnly ? "task" : "single"}`],
			style: {
				display: isTaskOnly ? viewBox(() => this.haveTask() ? "" : "none") : ""
			}
		})
		btn.addEventListener("click", e => {
			e.stopPropagation()
			const args = isTaskOnly ? this.getTask() : this.getPictureArgs()
			showTaskArgsModal(args)
		})
		return btn
	}

	makeFavButton(): HTMLElement {
		const favoriteButton = tag({class: [
			css.iconFavorite,
			{[css.deleted!]: this.picture.prop("deleted")},
			this.favAddTime.map(time => time !== null ? "icon-star" : "icon-star-empty")
		]})
		favoriteButton.addEventListener("click", async e => {
			e.stopPropagation()
			const isFavoriteNow = this.favAddTime() !== null
			this.favAddTime(isFavoriteNow ? null : 1)
			await ClientApi.setPictureFavorite(this.picture().id, !isFavoriteNow)
		})
		return favoriteButton
	}
}

export function TaskPicture(props: TaskPictureProps): HTMLElement {
	const url = props.picture.map(picture => ClientApi.getPictureUrl(picture.id, picture.salt))

	const imgPlaceholder = tag()

	const context = new TaskPictureContext(props.picture, props.generationTask)

	const isLoaded = box(props.loadAnimation ? false : true)

	const result: HTMLElement = tag({
		class: [css.taskPicture, {
			[css.disabled!]: props.isDisabled,
			[css.loaded!]: isLoaded
		}]
	}, [
		imgPlaceholder,
		tag({
			class: css.overlay,
			onClick: () => {
				requestAnimationFrame(() => {
					// raf is here to prevent opening and then immediately closing the viewer
					// it's some weird interference in events and closing-modal-by-background-click
					openViewer(props.picture, props.generationTask, props.onScroll)
				})
			},
			onMousedown: e => {
				if(e.button === 1){
					window.open(url(), "_blank")
				}
			}
		}, [
			tag({class: css.topRow}, [
				tag([context.makeShowParamsButton(true), context.makeShowParamsButton(false)]),
				tag([context.makeCopyTaskButton(), context.makeCopyButton()])
			]),
			tag({class: css.middleRow}, [
				tag({class: [css.iconOpen, "icon-resize-full-alt"]})
			]),
			tag({class: css.bottomRow}, [context.makeFavButton(), context.makeLinkButton()])
		])
	]);

	(async() => {
		const img = await props.thumbContext.getThumbnail(props.picture())
		imgPlaceholder.before(img)
		imgPlaceholder.remove()
		// FIXME: load animation...?
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
	})()

	return result
}

function openViewer(picture: MRBox<Picture>, task?: MRBox<GenerationTaskWithPictures>, onScroll?: ShowImageViewerProps<unknown>["onScroll"]): void {
	let props: ShowImageViewerProps<Picture>
	const commonProps = {
		makeUrl: (picture: Picture) => ClientApi.getPictureUrl(picture.id, picture.salt),
		panBounds: {x: "centerInPicture", y: "borderToBorder"},
		updateImg: (picture, img) => {
			if(picture.deleted){
				img.style.minWidth = "128px"
				img.style.minHeight = "128px"
				img.setAttribute("src", notFoundSvg)
			}
		},
		onScroll,
		getAdditionalControls: pic => {
			const cont = new TaskPictureContext(box(pic), task)
			return [
				tag({class: css.viewerButtons}, [
					cont.makeFavButton(),
					cont.makeLinkButton(),
					cont.makeCopyButton(),
					cont.makeCopyTaskButton(),
					cont.makeShowParamsButton(false),
					cont.makeShowParamsButton(true)
				])
			]
		}
	} satisfies Partial<ShowImageViewerProps<Picture>>
	if(task){
		const pictures = constBoxWrap(task).prop("pictures").map(x => [...x].reverse())
		const pictureIndex = pictures().indexOf(unbox(picture))
		props = {
			...commonProps,
			// makeUrl: picture => `https://dummyimage.com/256x${((picture.id % pictures().length) + 1) * 2}00`,
			// makeUrl: picture => `https://dummyimage.com/${((picture.id % pictures().length) + 1)}00x${((picture.id % pictures().length) + 1) * 2}00`,
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