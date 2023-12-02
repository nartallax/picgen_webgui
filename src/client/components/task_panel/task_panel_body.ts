import {ArrayItemWBox, RBox, WBox, box, calcBox} from "@nartallax/cardboard"
import * as css from "./task_panel.module.scss"
import {GenerationTaskWithPictures} from "common/entities/generation_task"
import {bindBox, onMount, tag} from "@nartallax/cardboard-dom"
import {Icon} from "client/generated/icons"
import {thumbnailProvider} from "client/app/global_values"
import {ImageVisibilityController} from "client/components/image_viewer/image_visibility_controller"
import {TaskPicture} from "client/components/task_picture/task_picture"
import {debounce} from "client/client_common/debounce"
import {SoftScroller} from "client/base/soft_scroller"
import {addDragScroll} from "client/client_common/drag_scroll"

interface Props {
	task: ArrayItemWBox<GenerationTaskWithPictures>
	deletionOpacity: RBox<number>
}

export const makeTaskPanelBody = (props: Props): {body: HTMLElement, scrollLeftButton: HTMLElement, scrollRightButton: HTMLElement} => {
	const pictures = props.task.prop("pictures").map(arr => [...arr].reverse(), arr => [...arr].reverse())
	const thumbContext = thumbnailProvider.makeContext({useDataAttribute: true})
	let isInDOM = false

	function detectCurrentScrollPictureIndex(): number | null {
		const parentRect = picturesWrap.getBoundingClientRect()
		const centerX = (parentRect.right + parentRect.left) / 2
		for(let i = 0; i < pictureContainer.children.length; i++){
			const pic = pictureContainer.children[i]!
			const childRect = pic.getBoundingClientRect()
			if(childRect.left > centerX){
				return Math.max(0, i - 1)
			}
		}
		return Math.max(0, pictureContainer.children.length - 1)
	}

	const visibilityController = new ImageVisibilityController()

	function scrollToNextPicture(direction: -1 | 1): void {
		const currentPicIndex = detectCurrentScrollPictureIndex()
		if(currentPicIndex === null){
			return
		}
		const nextPicIndex = currentPicIndex + direction
		const pic = pictureContainer.children[nextPicIndex]
		if(!(pic instanceof HTMLElement)){
			return
		}
		const picRect = pic.getBoundingClientRect()
		const picCenter = (picRect.right + picRect.left) / 2
		const parentRect = picturesWrap.getBoundingClientRect()
		const parentCenter = (parentRect.right + parentRect.left) / 2
		const diff = picCenter - parentCenter
		scroller.setScrollAmountToDo(diff)
	}

	function updateDisabledState(): void {
		const parentRect = picturesWrap.getBoundingClientRect()
		for(const {el, isDisabled} of picturesWithDisableBoxes){
			const rect = el.getBoundingClientRect()
			const left = Math.max(parentRect.left, rect.left)
			const right = Math.min(parentRect.right, rect.right)
			const visibleWidth = Math.max(0, right - left)
			const width = rect.right - rect.left
			const visibleRatio = visibleWidth / width
			isDisabled.set(visibleRatio < 0.5)
		}
	}

	const debouncedUpdateDisabledState = debounce(100, updateDisabledState)

	const picturesWithDisableBoxes: {el: HTMLElement, isDisabled: WBox<boolean>}[] = []

	const pictureContainer = tag({class: css.pictures},
		[pictures.mapArray(
			picture => picture.id,
			picture => {
				const isDisabled = box(true)
				const el = TaskPicture({
					visibilityController,
					picture,
					isDisabled,
					onLoad: debouncedUpdateDisabledState,
					loadAnimation: isInDOM,
					generationTask: props.task,
					thumbContext,
					onScroll: evt => {
						const width = evt.bounds.right - evt.bounds.left
						scroller.scrollToNow(scroller.scrollLimit.get() * (evt.x / width))
					}
				})
				picturesWithDisableBoxes.push({el, isDisabled})
				return el
			}
		)])

	const picturesWrap = tag({class: css.picturesWrap}, [pictureContainer])

	addDragScroll({
		type: "element",
		element: picturesWrap,
		constraintDirection: "horisontal",
		distanceBeforeMove: 10,
		dragSpeed: 2
	})

	const haveNotEnoughPictures = pictures.map(pics => pics.length < 2)

	const scroller = new SoftScroller(picturesWrap, "x", 200)

	bindBox(pictureContainer, scroller.scrollPosition, updateDisabledState)
	bindBox(pictureContainer, scroller.scrollableContentSize, updateDisabledState)
	onMount(pictureContainer, () => {
		updateDisabledState()
		isInDOM = true
		return () => isInDOM = false
	})

	visibilityController.attachTo(pictureContainer)

	const scrollLeftButton = tag({
		tag: "button",
		class: [css.arrow, Icon.leftOpenBig, {
			[css.disabled!]: scroller.isAtStart,
			[css.hidden!]: haveNotEnoughPictures
		}],
		style: {left: "0px"},
		onClick: () => scrollToNextPicture(-1)
	})
	const scrollRightButton = tag({
		tag: "button",
		class: [css.arrow, Icon.rightOpenBig, {
			[css.disabled!]: scroller.isAtFinish,
			[css.hidden!]: haveNotEnoughPictures
		}],
		style: {right: "0px"},
		onClick: () => scrollToNextPicture(1)
	})

	const gradientBox = calcBox([scroller.scrollPosition, scroller.scrollLimit, scroller.scrollableContentSize], (pos, lim) => {
		const maxMargin = scrollLeftButton.getBoundingClientRect().width
		const width = picturesWrap.getBoundingClientRect().width
		const startBlur = Math.min(pos, maxMargin)
		const endBlur = width - Math.min(maxMargin, lim - pos)
		return `linear-gradient(to right, rgba(0,0,0,0) 0, rgba(0,0,0,1) ${startBlur + "px"}, rgba(0,0,0,1) ${endBlur + "px"}, rgba(0,0,0,0) 100%)`
	})

	const body = tag({
		style: {
			opacity: props.deletionOpacity,
			webkitMaskImage: gradientBox,
			maskImage: gradientBox
		}
	}, [picturesWrap])

	return {body, scrollLeftButton, scrollRightButton}

}