import {formatTimeSpan} from "client/client_common/format"
import {TaskPicture} from "client/components/task_picture/task_picture"
import {limitClickRate} from "client/client_common/rate_limit"
import {ClientApi} from "client/app/client_api"
import {WBox, box, calcBox} from "@nartallax/cardboard"
import {bindBox, onMount, tag} from "@nartallax/cardboard-dom"
import * as css from "./task_panel.module.scss"
import {GenerationTaskWithPictures} from "common/entities/generation_task"
import {SoftScroller} from "client/base/soft_scroller"
import {addDragScroll} from "client/client_common/drag_scroll"
import {debounce} from "client/client_common/debounce"
import {loadArguments} from "client/app/load_arguments"
import {allKnownParamSets, thumbnailProvider} from "client/app/global_values"
import {Icon} from "client/generated/icons"
import {makeDeletionTimer} from "client/client_common/deletion_timer"
import {Row} from "client/controls/layout/row_col"
import {NoteBlock} from "client/components/note_block/note_block"

interface TaskPanelProps {
	task: WBox<GenerationTaskWithPictures>
	tasks: WBox<GenerationTaskWithPictures[]>
}

export function TaskPanel(props: TaskPanelProps): HTMLElement {
	const taskDeletionProgress = box(0)
	const taskDeletionOpacity = taskDeletionProgress.map(x => 1 - x)
	const pictures = props.task.prop("pictures").map(arr => [...arr].reverse(), arr => [...arr].reverse())
	const thumbContext = thumbnailProvider.makeContext()
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

	const delTaskNow = async() => {
		const id = props.task.get().id
		props.tasks.set(props.tasks.get().filter(task => task.id !== id))
		await ClientApi.deleteTask(id)
	}

	const delTimer = makeDeletionTimer(500, taskDeletionProgress, delTaskNow)

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

	const nowBox = box(Date.now())
	const paramSetOfTask = allKnownParamSets.get().find(x => x.internalName === props.task.get().paramSetName)
	const isEditingNote = box(false)

	const result = tag({class: [css.taskPanel]}, [
		tag({class: css.body}, [
			tag({class: css.header}, [
				tag({
					class: [
						css.killButton, Icon.cancel, {
							[css.hidden!]: props.task.map(task => task.status === "completed")
						}
					],
					attrs: {title: "Cancel"},
					onClick: limitClickRate(() => {
						ClientApi.killOwnTask(props.task.get().id)
					})
				}),
				tag({
					class: [
						css.deleteButton, Icon.trashEmpty, {
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
							delTaskNow()
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
				tag({class: [css.taskExitCodeError, Icon.warningEmpty, {
					[css.hidden!]: props.task.prop("exitCode").map(code => code === 0)
				}]}, [
					props.task.prop("exitCode").map(code => "Failed! Exit code " + code)
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
					class: [css.repeatButton, Icon.loop, {[css.hidden!]: props.task.map(task => task.status !== "completed")}],
					attrs: {title: "Repeat"},
					onClick: limitClickRate(() => {
						const task = props.task.get()
						ClientApi.createGenerationTask({
							arguments: task.arguments,
							paramSetName: task.paramSetName
						})
					})
				}),
				tag({class: css.timer}, [calcBox([props.task, nowBox], (task, now) => {
					switch(task.status){
						case "queued": return ""
						case "completed": {
							if(!task.startTime){
								return "" // did not start, was dropped out of queue
							}
							return formatTimeSpan((task.finishTime || 0) - task.startTime)
						}
						case "running": {
							const timePassed = formatTimeSpan(Math.floor(now / 1000) - (task.startTime || 0))
							const endTime = !task.estimatedDuration ? null : formatTimeSpan(task.estimatedDuration)
							return endTime ? `${timePassed} / ${endTime}` : timePassed
						}
					}
				})])
			]),
			tag({
				style: {
					opacity: taskDeletionOpacity,
					webkitMaskImage: gradientBox,
					maskImage: gradientBox
				}
			}, [picturesWrap]),
			tag({class: css.footer, style: {opacity: taskDeletionOpacity}}, [
				Row([
					tag({class: css.prompt}, [props.task.map(task => {
						if(!paramSetOfTask){
							return "<param set deleted, prompt parameter name unknown>"
						}
						return (task.arguments[paramSetOfTask.primaryParameter.jsonName] + "") ?? ""
					})]),
					tag({
						class: [css.useArgumentsButton, Icon.docs],
						onClick: limitClickRate(function() {
							loadArguments(props.task.get())
							this.classList.add(css.recentlyClicked!)
							setTimeout(() => {
								this.classList.remove(css.recentlyClicked!)
							}, 500)
						})
					}),
					tag({
						class: [css.addNoteButton, Icon.note],
						onClick: () => {
							isEditingNote.set(!isEditingNote.get())
						}
					})
				]),
				NoteBlock({
					isEditing: isEditingNote,
					note: props.task.prop("note"),
					save: note => ClientApi.setTaskNote(props.task.get().id, note)
				})
			])
		]),
		scrollLeftButton,
		scrollRightButton
	])

	onMount(result, () => {
		nowBox.set(Date.now())
		const interval = setInterval(() => {
			if(props.task.get().status === "running"){
				nowBox.set(Date.now())
			} else if(props.task.get().status === "completed"){
				clearInterval(interval)
			}
		}, 1000)
		return () => clearInterval(interval)
	})

	return result
}