import {MRBox, RBox, WBox, box, calcBox, constBoxWrap, isArrayItemWBox, isWBox, unbox} from "@nartallax/cardboard"
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
import {Icon} from "client/generated/icons"
import {DeletionTimer, makeDeletionTimer} from "client/client_common/deletion_timer"
import {argumentsByParamSet, currentParamSetName, defaultRedrawParameter} from "client/app/global_values"
import {ImageVisibilityController} from "client/components/image_viewer/image_visibility_controller"

interface TaskPictureProps {
	picture: WBox<Picture>
	isDisabled?: RBox<boolean>
	onLoad?: () => void
	generationTask?: MRBox<GenerationTaskWithPictures>
	loadAnimation?: boolean
	thumbContext: ThumbnailProvidingContext
	onScroll?: ShowImageViewerProps<unknown>["onScroll"]
	visibilityController?: ImageVisibilityController
}

class TaskPictureContext {
	readonly favAddTime: WBox<number | null> | null
	private readonly haveTask: RBox<boolean>
	readonly deletionProgress = box(0)
	readonly deletionTimer: DeletionTimer | null

	constructor(
		readonly picture: RBox<Picture>,
		readonly generationTask?: MRBox<GenerationTaskWithPictures>
	) {
		this.favAddTime = isWBox(picture) ? picture.prop("favoritesAddTime") : null
		this.haveTask = calcBox(
			[this.picture, constBoxWrap(this.generationTask)],
			(pic, task) => pictureHasAttachedTask(pic) || !!task
		)
		if(isArrayItemWBox(this.picture)){
			this.deletionTimer = makeDeletionTimer(500, this.deletionProgress, () => (void this.deletePicture()))
		} else {
			this.deletionTimer = null
		}
	}


	private getPictureArgs(): GenerationTaskInputData {
		return getTaskInputDataFromPicture(this.picture.get(), this.getTask())
	}

	private getTask(): GenerationTaskInputData {
		const pic = this.picture.get()
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
		return tag({
			tag: "a",
			attrs: {
				target: "_blank",
				href: this.picture.map(pic => ClientApi.getPictureUrl(pic.id, pic.salt))
			},
			class: [Icon.linkExt, css.iconLink]
		})
	}

	makeCopyButton(): HTMLElement {
		const copyButton = tag({class: [Icon.copySingle, css.iconCopy]})
		copyButton.addEventListener("click", e => {
			e.stopPropagation()
			loadArguments(this.getPictureArgs())
		})
		return copyButton
	}

	makeCopyTaskButton(): HTMLElement {
		const copyTaskButton = tag({
			class: [Icon.copyTask, css.iconCopy],
			style: {
				display: this.haveTask.map(haveTask => haveTask ? "" : "none")
			}
		})
		copyTaskButton.addEventListener("click", e => {
			e.stopPropagation()
			loadArguments(this.getTask())
		})
		return copyTaskButton
	}

	private async deletePicture(): Promise<void> {
		const arrayItemPicture = this.picture
		if(!isArrayItemWBox(arrayItemPicture)){
			return
		}

		const id = this.picture.get().id
		await ClientApi.deletePicture(id)
		arrayItemPicture.deleteArrayElement()
		this.deletionProgress.set(1)
	}

	makeDeleteButton(): HTMLElement | null {
		const timer = this.deletionTimer
		if(!timer){
			return null
		}
		const delTimer = timer // for typechecking

		const copyTaskButton = tag({
			class: [Icon.trashEmpty, css.iconDelete],
			attrs: {title: "Delete (hold shift to delete immediately!)"}
		})

		function runTimer(e: MouseEvent | TouchEvent) {
			e.preventDefault()
			e.stopPropagation()
			if(e.shiftKey){
				delTimer.completeNow()
			} else {
				delTimer.run()
			}
		}

		function cancelTimer(e: Event) {
			e.preventDefault()
			e.stopPropagation()
			delTimer.cancel()
		}

		copyTaskButton.addEventListener("mousedown", runTimer)
		copyTaskButton.addEventListener("touchstart", runTimer)
		copyTaskButton.addEventListener("mouseup", cancelTimer)
		copyTaskButton.addEventListener("touchend", cancelTimer)

		return copyTaskButton
	}

	makeShowParamsButton(isTaskOnly: boolean): HTMLElement {
		const btn = tag({
			class: [css.iconShowParams, isTaskOnly ? Icon.copyJsonTask : Icon.copyJsonSingle],
			style: {
				display: isTaskOnly ? this.haveTask.map(haveTask => haveTask ? "" : "none") : ""
			}
		})
		btn.addEventListener("click", e => {
			e.stopPropagation()
			const args = isTaskOnly ? this.getTask() : this.getPictureArgs()
			void showTaskArgsModal(args)
		})
		return btn
	}

	makeFavButton(): HTMLElement | null {
		const favBox = this.favAddTime
		if(!favBox){
			return null
		}

		const favoriteButton = tag({class: [
			css.iconFavorite,
			{[css.deleted!]: this.picture.prop("deleted")},
			favBox.map(time => time !== null ? Icon.star : Icon.starEmpty)
		]})

		favoriteButton.addEventListener("click", async e => {
			e.stopPropagation()
			const isFavoriteNow = favBox.get() !== null
			favBox.set(isFavoriteNow ? null : 1)
			await ClientApi.setPictureFavorite(this.picture.get().id, !isFavoriteNow)
		})
		return favoriteButton
	}

	makeRedrawButton(): HTMLElement {
		const redrawButton = tag({
			class: [Icon.repaint, css.iconRepaint],
			style: {
				display: defaultRedrawParameter.map(x => x ? "" : "none")
			}
		})

		redrawButton.addEventListener("click", e => {
			const picParam = defaultRedrawParameter.get()
			if(!picParam){
				return
			}
			const [paramSet, param] = picParam
			const allArgs = argumentsByParamSet.get()
			const paramSetArgs = allArgs[paramSet.internalName]
			if(!paramSetArgs){
				return
			}
			e.stopPropagation()

			const pic = this.picture.get()
			argumentsByParamSet.set({
				...allArgs,
				[paramSet.internalName]: {
					...paramSetArgs,
					[param.jsonName]: {id: pic.id, salt: pic.salt}
				}
			})
			currentParamSetName.set(paramSet.internalName)
		})


		return redrawButton
	}
}

export function TaskPicture(props: TaskPictureProps): HTMLElement {
	const url = props.picture.map(picture => ClientApi.getPictureUrl(picture.id, picture.salt))

	const context = new TaskPictureContext(props.picture, props.generationTask)

	const isLoaded = box(props.loadAnimation ? false : true)

	const openViewerForThisPicture = () => {
		requestAnimationFrame(() => {
			// raf is here to prevent opening and then immediately closing the viewer
			// it's some weird interference in events and closing-modal-by-background-click
			openViewer(props.picture, props.generationTask, props.onScroll)
		})
	}

	const img = props.thumbContext.getThumbnail(props.picture.get())
	// this is for mobile devices, on which overlay is disabled and non-clickable
	img.addEventListener("click", openViewerForThisPicture)

	const result: HTMLElement = tag({
		class: [css.taskPicture, {
			[css.disabled!]: props.isDisabled,
			[css.loaded!]: isLoaded
		}],
		style: {
			opacity: context.deletionProgress.map(x => 1 - x)
		}
	}, [
		img,
		tag({
			class: css.overlay,
			onClick: openViewerForThisPicture,
			onMousedown: e => {
				if(e.button === 1){
					window.open(url.get(), "_blank")
				}
			}
		}, [
			tag({class: css.topRow}, [
				tag([
					context.makeDeleteButton()
				]),
				tag({class: css.topRight}, [
					tag([context.makeShowParamsButton(true), context.makeShowParamsButton(false)]),
					tag([context.makeCopyTaskButton(), context.makeCopyButton()])
				])
			]),
			tag({class: css.middleRow}, [
				tag({class: css.sideColumn}),
				tag({class: [css.iconOpen, Icon.resizeFullAlt]}),
				tag({class: css.sideColumn}, [context.makeRedrawButton()])
			]),
			tag({class: css.bottomRow}, [context.makeFavButton(), context.makeLinkButton()])
		])
	])

	void(async() => {
		await props.thumbContext.waitNextBatchLoad()
		props.visibilityController?.addImage(img)
		if(!props.loadAnimation){
			if(props.onLoad){
				props.onLoad()
			}
		} else {
			isLoaded.set(true)
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
	const contexts = new WeakMap<RBox<Picture>, TaskPictureContext>()
	const getContext = (pic: RBox<Picture>) => {
		let context = contexts.get(pic)
		if(!context){
			context = new TaskPictureContext(pic, task)
			contexts.set(pic, context)
		}
		return context
	}

	const commonProps = {
		getId: picture => picture.id,
		getUrl: picture => picture.deleted ? notFoundSvg : ClientApi.getPictureUrl(picture.id, picture.salt),
		panBounds: {x: "centerInPicture", y: "borderToBorder"},
		onScroll,
		getAdditionalControls: pic => {
			const cont = getContext(pic)
			return [
				tag({class: css.viewerButtons}, [
					cont.makeFavButton(),
					cont.makeLinkButton(),
					cont.makeCopyButton(),
					cont.makeCopyTaskButton(),
					cont.makeShowParamsButton(false),
					cont.makeShowParamsButton(true),
					cont.makeRedrawButton(),
					cont.makeDeleteButton()
				])
			]
		},
		getPictureOpacity: pic => {
			const cont = getContext(pic)
			return cont.deletionProgress.map(x => 1 - x)
		},
		getDeletionTimer: pic => {
			const cont = getContext(pic)
			return cont.deletionTimer
		},
		getDimensions: pic => pic.deleted ? {width: 128, height: 128} : pic
	} satisfies Partial<ShowImageViewerProps<Picture>>
	if(task){
		const srcOrderPics = constBoxWrap(task).prop("pictures")
		const rev = <T>(x: readonly T[]): T[] => [...x].reverse()
		const pictures = isWBox(srcOrderPics) ? srcOrderPics.map(rev, rev) : srcOrderPics.map(rev)
		const pictureIndex = pictures.get().indexOf(unbox(picture))
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

	void showImageViewer(props)
}