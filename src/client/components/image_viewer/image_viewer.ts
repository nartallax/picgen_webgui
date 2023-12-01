import {bindBox, onMount, tag} from "@nartallax/cardboard-dom"
import {Modal, showModalBase} from "client/controls/modal_base/modal_base"
import * as css from "./image_viewer.module.scss"
import {MRBox, RBox, box, calcBox, constBoxWrap} from "@nartallax/cardboard"
import {pointerEventsToClientCoords} from "client/client_common/mouse_drag"
import {addDragScroll} from "client/client_common/drag_scroll"
import {addTouchZoom} from "client/client_common/touch_zoom"
import {debounce} from "client/client_common/debounce"
import {preventGalleryImageInteractions, shiftWheelForZoom, shiftWheelHint} from "client/app/global_values"
import {SmoothValueChanger} from "client/base/smooth_value_changer"
import {TopToast, showTopToast} from "client/controls/toast/top_toast"
import {DeletionTimer} from "client/client_common/deletion_timer"
import {ImageVisibilityController} from "client/components/image_viewer/image_visibility_controller"

type PanBoundsType = "centerInPicture" | "borderToBorder" | "none"

type BoundCalcParams = {
	readonly max: number
	readonly min: number
	readonly windowSize: number
	readonly type: PanBoundsType
	readonly zoom: number
	readonly borderOffset: number
}

type Bounds = {max: number, min: number}

function calculateBoundsForImageViewer(params: BoundCalcParams): Bounds {
	switch(params.type){
		case "none": return {min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER}
		case "centerInPicture": return {min: params.min, max: params.max}
		case "borderToBorder": {
			let min = (params.min - params.borderOffset) + params.windowSize / 2
			let max = (params.max + params.borderOffset) - params.windowSize / 2
			if(min > max){
				min = 0
				max = 0
			}
			return {min, max}
		}
	}

}

interface RectBounds {
	readonly top: number
	readonly bottom: number
	readonly left: number
	readonly right: number
}

export type ShowImageViewerProps<T> = {
	readonly imageDescriptions: RBox<readonly T[]>
	readonly getDimensions: (imageDescription: T) => ({readonly width: number, readonly height: number})
	readonly getId: (imageDescription: T) => string | number
	readonly getUrl: (imageDescription: T) => string
	readonly zoomSpeed?: number
	readonly centerOn?: number
	readonly equalizeByHeight?: boolean
	readonly panBounds?: {
		readonly x: PanBoundsType
		readonly y: PanBoundsType
	}
	/** A fraction of picture that will be used as offset.
	 * 0.1 means that there will be borders of 10% of picture height. */
	readonly defaultOffset?: number
	readonly getAdditionalControls?: (picture: RBox<T>) => HTMLElement[]
	readonly getPictureOpacity?: (picture: RBox<T>) => MRBox<number>
	readonly onScroll?: (args: {x: number, y: number, zoom: number, bounds: RectBounds}) => void
	readonly getDeletionTimer?: (picture: RBox<T>) => DeletionTimer | null
}

export async function showImageViewer<T>(props: ShowImageViewerProps<T>): Promise<void> {
	// debug dot right in the center of the screen
	// document.body.appendChild(tag({style: {
	// 	width: "10px",
	// 	height: "10px",
	// 	position: "absolute",
	// 	top: "50vh",
	// 	left: "50vw",
	// 	transform: "translate(-5px, -5px)",
	// 	backgroundColor: "red"
	// }}))

	const defaultOffsetZoomMult = 1 / (1 + (props.defaultOffset ?? 0.1))
	// console.log({defaultOffsetZoomMult})

	const isGrabbed = box(false)
	// screenspace coords of the center of the screen. they include zoom.
	const xPos = box(0)
	const yPos = box(0)

	const maxNatHeight = box(0)

	const bounds = {
		top: Number.MIN_SAFE_INTEGER,
		bottom: Number.MAX_SAFE_INTEGER,
		left: Number.MIN_SAFE_INTEGER,
		right: Number.MAX_SAFE_INTEGER
	}

	const updateBounds = debounce(1, async() => {
		const imgArr = imgs.get()

		const halfWidth = (window.innerWidth / 2)// * zoom()
		const halfHeight = (window.innerHeight / 2)// * zoom()

		let top = Number.MAX_SAFE_INTEGER,
			bottom = Number.MIN_SAFE_INTEGER,
			left = Number.MAX_SAFE_INTEGER,
			right = Number.MIN_SAFE_INTEGER
		for(const img of imgArr){
			const rect = img.getBoundingClientRect()
			top = Math.min(top, rect.top - halfHeight + yPos.get())
			bottom = Math.max(bottom, rect.bottom - halfHeight + yPos.get())
			left = Math.min(left, rect.left - halfWidth + xPos.get())
			right = Math.max(right, rect.right - halfWidth + xPos.get())
		}

		const verticalBounds = calculateBoundsForImageViewer({
			min: top, max: bottom,
			borderOffset: (window.innerHeight / 2) * (1 - defaultOffsetZoomMult),
			type: props.panBounds?.y ?? "none", windowSize: window.innerHeight, zoom: zoom.get()
		})
		const horisontalBounds = calculateBoundsForImageViewer({
			min: left, max: right,
			borderOffset: (window.innerWidth / 2) * (1 - defaultOffsetZoomMult),
			type: props.panBounds?.x ?? "none", windowSize: window.innerWidth, zoom: zoom.get()
		})
		bounds.top = verticalBounds.min
		bounds.bottom = verticalBounds.max
		bounds.left = horisontalBounds.min
		bounds.right = horisontalBounds.max


		updatePanX()
		updatePanY()
		lastKnownHeight = null
	})

	const zoom = box(1)
	const smoothZoomChanger = new SmoothValueChanger(zoom, 150, {curvePower: 3})

	let lastScrollActionCoords: {
		abs: {x: number, y: number}
		rel: {x: number, y: number}
	} | null = null

	function scrollToNextImage(direction: -1 | 1): void {
		const targetIndex = getCentralImageIndex() + direction
		const imgArr = imgs.get()
		if(targetIndex >= imgArr.length || targetIndex < 0){
			return
		}
		centerOn(imgArr[targetIndex]!, true, true)
	}

	function getCentralImageIndex(): number {
		const windowCenter = window.innerWidth / 2
		const imgArr = imgs.get()
		for(let i = 0; i < imgArr.length; i++){
			const img = imgArr[i]!
			const rect = img.getBoundingClientRect()
			if(rect.left > windowCenter){
				return Math.max(0, i - 1)
			}
		}
		return imgArr.length - 1
	}

	function calcDefaultZoomForImage(img: HTMLImageElement): number {
		const height = props.equalizeByHeight ? maxNatHeight.get() : getNatHeight(img)
		const width = props.equalizeByHeight ? (getNatWidth(img) / getNatHeight(img)) * maxNatHeight.get() : getNatWidth(img)
		const hRatio = window.innerHeight / height
		const wRatio = window.innerWidth / width
		const newZoom = Math.min(1, Math.min(hRatio, wRatio) * defaultOffsetZoomMult)
		return newZoom
	}

	const smoothXChanger = new SmoothValueChanger(xPos, 150, {curvePower: 3})
	const smoothYChanger = new SmoothValueChanger(yPos, 150, {curvePower: 3})
	function centerOn(img: HTMLImageElement, smooth?: boolean, preserveZoom?: boolean): void {
		if(!preserveZoom){
			smoothZoomChanger.set(calcDefaultZoomForImage(img))
		}

		const upcomingZoomChange = smoothZoomChanger.get() / zoom.get()

		const imgRect = img.getBoundingClientRect()

		const imgLeft = imgRect.left - (window.innerWidth / 2)

		;(smooth ? smoothYChanger : yPos).set(0)
		;(smooth ? smoothXChanger : xPos).set(xPos.get() + (imgLeft * upcomingZoomChange) + (imgRect.width * upcomingZoomChange / 2))
	}

	// scroll view in a way that point of the picture is present at the coords of the screen
	// relPoint is normalized
	function scrollCoordsToPoint(absCoords: {x: number, y: number}, relPoint: {x: number, y: number}): void {
		const width = wrap.scrollWidth * zoom.get()
		const height = wrap.scrollHeight * zoom.get()
		const left = -((relPoint.x * width) - absCoords.x)
		const top = -((relPoint.y * height) - absCoords.y)
		xPos.set(left)
		yPos.set(top)
	}

	function setZoomByCoords(absCoords: {x: number, y: number}, value: number, instant?: boolean): void {
		absCoords = {...absCoords}
		absCoords.x = (-absCoords.x + (window.innerWidth / 2))
		absCoords.y = (-absCoords.y + (window.innerHeight / 2))
		const relOffsetCoords = {
			x: (absCoords.x - xPos.get()) / (wrap.scrollWidth * zoom.get()),
			y: (absCoords.y - yPos.get()) / (wrap.scrollHeight * zoom.get())
		}
		lastScrollActionCoords = {abs: absCoords, rel: relOffsetCoords}

		if(instant){
			zoom.set(value)
			scrollCoordsToPoint(lastScrollActionCoords.abs, lastScrollActionCoords.rel)
		} else {
			smoothZoomChanger.set(value)
		}
	}

	function setZoom(e: MouseEvent | TouchEvent, value: number): void {
		setZoomByCoords(pointerEventsToClientCoords(e), value)
	}

	// this exists to prevent frequent .getBoundingClientRect() calls
	// which helps FPS when zooming
	let lastKnownHeight: number | null = null
	function calcZoomnessRate(img: HTMLImageElement): number {
		const height = lastKnownHeight !== null && props.equalizeByHeight
			? lastKnownHeight
			: lastKnownHeight = img.getBoundingClientRect().height
		return height / getNatHeight(img)
	}

	function getNatHeight(picture: HTMLImageElement): number {
		return parseInt(picture.dataset["natHeight"] ?? "")
	}

	function getNatWidth(picture: HTMLImageElement): number {
		return parseInt(picture.dataset["natWidth"] ?? "")
	}

	const visibilityController = new ImageVisibilityController()

	const imgsWithLabelsAndBoxes = props.imageDescriptions.mapArray(
		desc => props.getId(desc),
		descBox => {
			const {width: natWidth, height: natHeight} = props.getDimensions(descBox.get())
			const natSideRatio = natWidth / natHeight
			if(natHeight > maxNatHeight.get()){
				maxNatHeight.set(natHeight)
				lastKnownHeight = null
			}

			// width of this picture if we are equalizing by height
			const eqWidthByHeight = maxNatHeight.map(height => (natSideRatio * height))

			let _img: HTMLImageElement | null = null
			_img = tag({
				tag: "img",
				attrs: {alt: ""},
				style: {
					width: !props.equalizeByHeight
						? natWidth + "px"
						: eqWidthByHeight.map(eqWidth => eqWidth + "px"),
					height: !props.equalizeByHeight
						? natHeight + "px"
						: maxNatHeight.map(maxNatHeight => maxNatHeight + "px"),
					imageRendering: zoom.map(() => _img && calcZoomnessRate(_img) >= 1 ? "pixelated" : "auto")
				},
				onMousedown: e => {
					if(e.button === 1){
						window.open(props.getUrl(descBox.get()), "_blank")
					}
				}
			})
			const img: HTMLImageElement = _img
			img.dataset["natWidth"] = natWidth + ""
			img.dataset["natHeight"] = natHeight + ""
			img.dataset["src"] = props.getUrl(descBox.get())
			const isVisible = box(false)

			visibilityController.addImage(img, isVisibleNow => {
				isVisible.set(isVisibleNow)
			})

			updateBounds()

			const label = tag({
				class: css.imgLabel,
				style: {
					transform: zoom.map(zoom => `scale(${1 / zoom})`)
				}
			})

			const updateLabel = debounce(1, () => {
				label.textContent = `${getNatWidth(img)} x ${getNatHeight(img)}, ${(calcZoomnessRate(img) * 100).toFixed(2)}%`
			})
			bindBox(label, zoom, updateLabel)
			bindBox(label, maxNatHeight, updateLabel)

			let additionalControls: HTMLElement | null = null
			if(props.getAdditionalControls){
				additionalControls = tag({
					class: css.additionalControls,
					style: {
						transform: zoom.map(zoom => `scale(${1 / zoom})`),
						width: calcBox([zoom, eqWidthByHeight], (zoom, eqWidth) => {
							const w = !props.equalizeByHeight ? getNatWidth(img) : eqWidth
							return (w * zoom) + "px"
						})
					}
				}, props.getAdditionalControls(descBox))
			}

			// this exists to prevent native browser behaviour about image dragging
			// it will be easier to do with `pointer-events: none` on img
			// but that will also disable image's context menu (this approach will not, on most systems)
			const imgOverlay = tag({class: css.imgOverlay, style: {
				display: preventGalleryImageInteractions.map(prevent => prevent ? "" : "none")
			}})

			const imgWrap = tag({
				class: css.imgWrap
			}, [img, tag([
				// this allow to avoid recalc of labels and other stuff for non-visible images
				isVisible.map(visible => !visible ? null : [label, additionalControls, imgOverlay])
			])])

			if(props.getPictureOpacity){
				const opacity = constBoxWrap(props.getPictureOpacity(descBox))
				bindBox(imgWrap, opacity, opacity => {
					imgWrap.style.opacity = opacity + ""
				})
			}

			return [imgWrap, descBox] as const
		}
	)

	const imgs = imgsWithLabelsAndBoxes.map(wraps => wraps.map(wrap => wrap[0].getElementsByTagName("img")[0]!))

	const wrap = tag({
		class: [css.imageViewer],
		style: {
			transform: zoom.map(zoom => `scale(${zoom})`)
		},
		onClick: () => modal.close()
	})

	bindBox(wrap, imgsWithLabelsAndBoxes, els => wrap.replaceChildren(...els.map(x => x[0])))

	onMount(wrap, async() => {
		const targetIndex = props.centerOn ?? 0

		const imgArr = imgs.get()
		const targetImg = imgArr[targetIndex]!

		await updateBounds.waitForScheduledRun()
		centerOn(targetImg)
	})

	onMount(wrap, () => {
		const onKeyDown = (e: KeyboardEvent) => {
			if(e.key === "ArrowRight"){
				scrollToNextImage(1)
			} else if(e.key === "ArrowLeft"){
				scrollToNextImage(-1)
			} else if(e.key === "Escape"){
				modal.close()
			}
		}
		window.addEventListener("keydown", onKeyDown)
		return () => window.removeEventListener("keydown", onKeyDown)
	})

	const onScrollHandler = debounce(1, () => {
		if(props.onScroll){
			props.onScroll({x: xPos.get(), y: yPos.get(), zoom: zoom.get(), bounds})
		}
	})

	const updatePanX = () => {
		const x = xPos.get()
		const fx = Math.max(bounds.left, Math.min(bounds.right, x))
		if(fx !== x){
			xPos.set(fx)
			return
		}
		wrap.style.left = (-x + (window.innerWidth / 2)) + "px"
		onScrollHandler()
	}

	const updatePanY = () => {
		const y = yPos.get()
		const fy = Math.max(bounds.top, Math.min(bounds.bottom, y))
		if(fy !== y){
			yPos.set(fy)
			return
		}
		wrap.style.top = (-y + (window.innerHeight / 2)) + "px"
		onScrollHandler()
	}

	// those handlers are only to have better control over updates
	// (i.e. to impose boundaries)
	bindBox(wrap, xPos, updatePanX)
	bindBox(wrap, yPos, updatePanY)

	bindBox(wrap, zoom, () => {
		updateBounds()
		lastKnownHeight = null
		if(lastScrollActionCoords){
			scrollCoordsToPoint(lastScrollActionCoords.abs, lastScrollActionCoords.rel)
		}
	})

	const modal = showModalBase({
		closeByBackgroundClick: true,
		overlayClass: isGrabbed.map(grabbed => `${css.imageViewerModal} ${!grabbed ? "" : css.grabbed}`)
	}, [wrap])

	function getNextZoomValue(direction: -1 | 1, currentImageZoomness: number, speed: number): number {

		const nowZoom = smoothZoomChanger.get()
		let nextZoom = nowZoom * (direction === 1 ? (1 + speed) : (1 / (1 + speed)))

		function willHitZoomBreakpoint(breakpoint: number): boolean {
			if(Math.abs(nowZoom - breakpoint) < 0.001){
				return false // to prevent locking on a breakpoint
			}
			return (nowZoom < breakpoint) === (nextZoom > breakpoint)
		}

		const img = imgs.get()[getCentralImageIndex()]

		const breakpoints = [
			nowZoom * (1 / currentImageZoomness),
			!img ? 1 : calcDefaultZoomForImage(img)
		]

		for(const breakpoint of breakpoints){
			if(willHitZoomBreakpoint(breakpoint)){
				nextZoom = breakpoint
				break
			}
		}

		return nextZoom
	}

	const stepZoom = (e: WheelEvent) => {
		const centralIndex = getCentralImageIndex()
		const centralImage = imgs.get()[centralIndex]!
		setZoom(e, getNextZoomValue(
			e.deltaY > 0 ? -1 : 1,
			calcZoomnessRate(centralImage),
			props.zoomSpeed ?? 0.2
		))
	}

	const stepShift = (e: WheelEvent) => {
		const direction = e.deltaY > 0 ? 1 : -1
		scrollToNextImage(direction)
	}

	modal.overlay.addEventListener("wheel", e => {
		e.preventDefault()
		if(e.shiftKey === shiftWheelForZoom.get()){
			stepZoom(e)
		} else {
			stepShift(e)
		}
	})

	addDragScroll({
		type: "box",
		x: xPos,
		y: yPos,
		element: modal.overlay,
		isDragging: isGrabbed,
		dragSpeed: 2
	})

	addTouchZoom({
		target: modal.overlay,
		multiplier: 1.5,
		getZoom: () => zoom.get(),
		setZoom: (zoomValue, centerCoords) => setZoomByCoords(centerCoords, zoomValue, true)
	})

	addDeleteHandler(() => {
		const index = getCentralImageIndex()
		return imgsWithLabelsAndBoxes.get()[index]?.[1]
	}, modal, props)

	let toast: TopToast | null = null
	if(shiftWheelForZoom.get() && shiftWheelHint.get()){
		toast = showTopToast({
			text: "Shift+wheel for zoom, wheel for scroll.\nAdjustable in settings.",
			timeMs: 2000
		})
	}

	onMount(modal.overlay, () => {
		visibilityController.start()
		return () => visibilityController.stop()
	}, {ifInDom: "call"})

	await modal.waitClose()
	if(toast){
		toast.remove()
	}
}

function addDeleteHandler<T>(getCentralBox: () => RBox<T> | undefined, modal: Modal, props: ShowImageViewerProps<T>): void {
	let currentDeletionTimer: DeletionTimer | null = null
	onMount(modal.overlay, () => {
		const onDown = (e: KeyboardEvent) => {
			if(e.key !== "Delete" || !props.getDeletionTimer){
				return
			}

			const descBox = getCentralBox()
			if(!descBox){
				return
			}

			currentDeletionTimer = props.getDeletionTimer(descBox)
			if(!currentDeletionTimer){
				return
			}

			if(e.shiftKey){
				currentDeletionTimer.completeNow()
				currentDeletionTimer = null
			} else {
				currentDeletionTimer.run()
			}
		}
		const onUp = (e: KeyboardEvent) => {
			if(e.key !== "Delete"){
				return
			}
			if(currentDeletionTimer){
				currentDeletionTimer.cancel()
				currentDeletionTimer = null
			}
		}

		window.addEventListener("keydown", onDown, {passive: true})
		window.addEventListener("keyup", onUp, {passive: true})

		return () => {
			window.removeEventListener("keydown", onDown)
			window.removeEventListener("keyup", onUp)
		}
	}, {ifInDom: "call"})
}