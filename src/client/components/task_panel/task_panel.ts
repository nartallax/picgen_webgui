import {formatTimeSpan} from "client/client_common/format"
import {getNowBox} from "client/base/now_box"
import {TaskPicture} from "client/components/task_picture/task_picture"
import {limitClickRate} from "client/client_common/rate_limit"
import {ClientApi} from "client/app/client_api"
import {RBox, WBox, box, viewBox} from "@nartallax/cardboard"
import {onMount, tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./task_panel.module.scss"
import {GenerationTaskWithPictures} from "common/entities/generation_task"
import {SoftScroller} from "client/base/soft_scroller"
import {addDragScroll} from "client/client_common/drag_scroll"
import {debounce} from "client/client_common/debounce"
import {loadArguments} from "client/app/load_arguments"

interface TaskPanelProps {
	task: RBox<GenerationTaskWithPictures>
}

export function TaskPanel(props: TaskPanelProps): HTMLElement {
	const nowBox = getNowBox()
	const taskHidden = box(false)
	const taskDeletionProgress = box(0)
	const pictures = props.task.prop("pictures").map(arr => [...arr].reverse())
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
			isDisabled(visibleRatio < 0.5)
		}
	}

	const debouncedUpdateDisabledState = debounce(100, updateDisabledState)

	const picturesWithDisableBoxes: {el: HTMLElement, isDisabled: WBox<boolean>}[] = []

	const pictureContainer = tag({class: css.pictures},
		pictures.mapArray(
			picture => picture.id,
			picture => {
				const isDisabled = box(true)
				const el = TaskPicture({
					picture,
					isDisabled,
					onLoad: debouncedUpdateDisabledState,
					loadAnimation: isInDOM,
					generationTask: props.task
				})
				picturesWithDisableBoxes.push({el, isDisabled})
				return el
			}
		))

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

	whileMounted(pictureContainer, scroller.scrollPosition, updateDisabledState)
	whileMounted(pictureContainer, scroller.scrollableContentSize, updateDisabledState)
	onMount(pictureContainer, () => {
		updateDisabledState()
		isInDOM = true
		return () => isInDOM = false
	})

	const delTimer = makeDeletionTimer(500, taskDeletionProgress, async() => {
		await ClientApi.deleteTask(props.task().id)
		taskHidden(true)
	})

	const result = tag({class: [css.taskPanel, {[css.hidden!]: taskHidden}]}, [
		tag({class: css.body}, [
			tag({class: css.header}, [
				tag({
					class: [
						css.killButton, "icon-cancel", {
							[css.hidden!]: props.task.map(task => task.status === "completed")
						}
					],
					attrs: {title: "Cancel"},
					onClick: limitClickRate(() => {
						ClientApi.killOwnTask(props.task().id)
					})
				}),
				tag({
					class: [
						css.deleteButton, "icon-trash-empty", {
							[css.hidden!]: props.task.map(task => task.status !== "completed")
						}
					],
					attrs: {title: "Delete (hold shift to delete immediately!)"},
					onMousedown: () => delTimer.run(),
					onTouchstart: () => delTimer.run(),
					onMouseup: () => delTimer.cancel(),
					onTouchend: () => delTimer.cancel(),
					onClick: limitClickRate(async e => {
						if(e.shiftKey){
							await ClientApi.deleteTask(props.task().id)
							taskHidden(true)
						}
					})
				}),
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
							arguments: task.arguments,
							prompt: task.prompt,
							paramSetName: task.paramSetName
						})
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
						case "running": {
							const timePassed = formatTimeSpan(Math.floor(nowBox() / 1000) - (task.startTime || 0))
							const endTime = !task.estimatedDuration ? null : formatTimeSpan(task.estimatedDuration)
							return endTime ? `${timePassed} / ${endTime}` : timePassed
						}
					}
				})])
			]),
			tag({
				class: css.picturesWrapWrap,
				style: {
					opacity: taskDeletionProgress.map(x => 1 - x)
				}
			}, [picturesWrap]),
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

interface DeletionTimer {
	cancel(): void
	run(): void
}

function makeDeletionTimer(duration: number, box: WBox<number>, afterEnd: () => void): DeletionTimer {
	let rafHandle: ReturnType<typeof requestAnimationFrame> | null = null
	let startTime = 0

	const onFrame = () => {
		rafHandle = null
		const passedTime = Date.now() - startTime
		const passedPercent = passedTime / duration
		if(passedPercent >= 1){
			box(1)
			cancel()
			afterEnd()
			return
		}

		box(passedPercent)
		rafHandle = requestAnimationFrame(onFrame)
	}

	const cancel = () => {
		box(0)
		if(rafHandle){
			cancelAnimationFrame(rafHandle)
			rafHandle = null
		}
	}

	const run = () => {
		if(rafHandle){
			return
		}

		startTime = Date.now()
		onFrame()
	}

	return {run, cancel}
}