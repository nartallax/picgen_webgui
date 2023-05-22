import {formatTimeSpan} from "client/client_common/format"
import {getNowBox} from "client/base/now_box"
import {OpenTaskPictureViewerArgs, TaskPicture} from "client/components/task_picture/task_picture"
import {limitClickRate} from "client/client_common/rate_limit"
import {ClientApi} from "client/app/client_api"
import {RBox, WBox, box, viewBox} from "@nartallax/cardboard"
import {onMount, tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./task_panel.module.scss"
import {GenerationTaskArgument, GenerationTaskInputData, GenerationTaskWithPictures} from "common/entities/generation_task"
import {allKnownContentTags, allKnownParamSets, allKnownShapeTags, currentArgumentBoxes, currentContentTags, currentParamSetName, currentPrompt, currentShapeTag} from "client/app/global_values"
import {decomposePrompt} from "client/app/prompt_composing"
import {showToast} from "client/controls/toast/toast"
import {SoftScroller} from "client/base/soft_scroller"
import {addDragScroll} from "client/client_common/drag_scroll"
import {showImageViewer} from "client/components/image_viewer/image_viewer"
import {debounce} from "client/client_common/debounce"

interface TaskPanelProps {
	task: RBox<GenerationTaskWithPictures>
}

export function TaskPanel(props: TaskPanelProps): HTMLElement {
	const nowBox = getNowBox()
	const taskHidden = box(false)
	const pictures = props.task.prop("pictures")
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
		// can happen if there's not enough pictures
		return null
	}

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
		scroller.scroll(diff)
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
			isDisabled(visibleRatio < 0.5)
		}
	}

	const debouncedUpdateDisabledState = debounce(100, updateDisabledState)

	const picturesWithDisableBoxes: {el: HTMLElement, isDisabled: WBox<boolean>}[] = []

	function openViewer(args: OpenTaskPictureViewerArgs): void {
		const pictureIndex = pictures().indexOf(args.picture)
		const urls = pictures.mapArray(
			picture => picture.id,
			picture => ClientApi.getPictureUrl(picture().id, picture().salt)
		)
		showImageViewer({urls, centerOn: pictureIndex < 0 ? undefined : pictureIndex})
	}

	const pictureContainer = tag({class: css.pictures},
		pictures.map(pics => [...pics].reverse()).mapArray(
			picture => picture.id,
			picture => {
				const isDisabled = box(true)
				const el = TaskPicture({
					picture,
					isDisabled,
					openViewer,
					onLoad: debouncedUpdateDisabledState,
					loadAnimation: isInDOM
				})
				picturesWithDisableBoxes.push({el, isDisabled})
				return el
			}
		))

	const picturesWrap = tag({class: css.picturesWrap}, [pictureContainer])

	addDragScroll({element: picturesWrap})

	const haveNotEnoughPictures = pictures.map(pics => pics.length < 2)

	const scroller = new SoftScroller(picturesWrap, "x", 200)

	whileMounted(pictureContainer, scroller.scrollPosition, updateDisabledState)
	whileMounted(pictureContainer, scroller.scrollableContentSize, updateDisabledState)
	onMount(pictureContainer, () => {
		updateDisabledState()
		isInDOM = true
		return () => isInDOM = false
	})

	const result = tag({class: [css.taskPanel, {[css.hidden!]: taskHidden}]}, [
		tag({class: css.body}, [
			tag({class: css.header}, [
				tag({class: css.id}, [props.task.map(task => "#" + task.id)]),
				tag({class: css.status}, [
					props.task.map(task => {
						switch(task.status){
							case "completed": return "Done"
							case "running": return "Running"
							case "queued": return "Queued"
						}
					})
				]),
				tag({class: css.doneCounter}, [
					props.task.map(task => {
						if(task.generatedPictures < 1 && !task.expectedPictures){
							return ""
						}
						return task.generatedPictures + " / " + (task.expectedPictures === null ? "???" : task.expectedPictures)
					})
				]),
				tag({
					class: [css.repeatButton, "icon-loop", {[css.hidden!]: props.task.map(task => task.status !== "completed")}],
					attrs: {title: "Repeat"},
					onClick: limitClickRate(() => {
						const task = props.task()
						ClientApi.createGenerationTask({
							params: task.params,
							prompt: task.prompt,
							paramSetName: task.paramSetName
						})
					})
				}),
				tag({
					class: [css.killButton, "icon-cancel", {[css.hidden!]: props.task.map(task => task.status === "completed")}],
					attrs: {title: "Cancel"},
					onClick: limitClickRate(() => {
						ClientApi.killOwnTask(props.task().id)
					})
				}),
				tag({
					class: [css.deleteButton, "icon-trash-empty", {[css.hidden!]: props.task.map(task => task.status !== "completed")}],
					attrs: {title: "Delete"},
					onClick: limitClickRate(async() => {
						await ClientApi.hideTask(props.task().id)
						taskHidden(true)
					})
				}),
				tag({class: css.timer}, [viewBox(() => {
					const task = props.task()
					switch(task.status){
						case "queued": return ""
						case "completed": {
							if(!task.startTime){
								return "" // did not start, was dropped out of queue
							}
							return formatTimeSpan((task.finishTime || 0) - task.startTime)
						}
						case "running": return formatTimeSpan(Math.floor(nowBox() / 1000) - (task.startTime || 0))
					}
				})])
			]),
			tag({class: css.picturesWrapWrap}, [picturesWrap]),
			tag({class: css.footer}, [
				tag({class: css.prompt}, [props.task.map(task => task.prompt)]),
				tag({
					class: [css.useArgumentsButton, "icon-docs"],
					onClick: limitClickRate(function() {
						loadArguments(props.task())
						this.classList.add(css.recentlyClicked!)
						setTimeout(() => {
							this.classList.remove(css.recentlyClicked!)
						}, 500)
					})
				})
			])
		]),
		tag({
			tag: "button",
			class: [css.arrow, "icon-left-open-big", {
				[css.disabled!]: scroller.isAtStart,
				[css.hidden!]: haveNotEnoughPictures
			}],
			style: {left: "0px"},
			onClick: () => scrollToNextPicture(-1)
		}),
		tag({
			tag: "button",
			class: [css.arrow, "icon-right-open-big", {
				[css.disabled!]: scroller.isAtFinish,
				[css.hidden!]: haveNotEnoughPictures
			}],
			style: {right: "0px"},
			onClick: () => scrollToNextPicture(1)
		})
	])

	return result
}

function loadArguments(task: GenerationTaskInputData): void {
	const paramSet = allKnownParamSets().find(paramSet => paramSet.internalName === task.paramSetName)
	if(!paramSet){
		showToast({
			text: `There's no parameter set ${task.paramSetName} anymore. This task used that parameter set. Cannot load values.`,
			type: "error"
		})
		return
	}


	const prompt = decomposePrompt(task.prompt, allKnownShapeTags() ?? [], Object.keys(allKnownContentTags() ?? {}))

	currentParamSetName(task.paramSetName)
	currentShapeTag(prompt.shape)
	currentPrompt(prompt.body)
	currentContentTags(prompt.content)

	const nonLoadableParamNames: string[] = []
	for(const [key, value] of Object.entries(task.params)){
		const argBox = currentArgumentBoxes[key]
		if(!argBox){
			nonLoadableParamNames.push(key)
		}
		(argBox as WBox<GenerationTaskArgument>)(value)
	}

	if(nonLoadableParamNames.length > 0){
		showToast({
			text: `Some of parameters of the task are now non-existent and wasn't loaded: ${nonLoadableParamNames.join(", ")}`,
			type: "info"
		})
	}

}