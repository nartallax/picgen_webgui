import {onMount, tag, whileMounted} from "@nartallax/cardboard-dom"
import {showModalBase} from "client/controls/modal_base/modal_base"
import * as css from "./image_viewer.module.scss"
import {RBox, box, viewBox} from "@nartallax/cardboard"
import {pointerEventsToClientCoords} from "client/client_common/mouse_drag"
import {addDragScroll} from "client/client_common/drag_scroll"
import {SoftValueChanger} from "client/base/soft_value_changer"
import {addTouchZoom} from "client/client_common/touch_zoom"
import {debounce} from "client/client_common/debounce"

function waitLoadEvent(img: HTMLImageElement): Promise<void> {
	return new Promise(ok => {
		if(img.complete){
			ok()
			return
		}
		function onImageLoad(): void {
			img.removeEventListener("load", onImageLoad)
			ok()
		}
		img.addEventListener("load", onImageLoad)
	})
}

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

export type ShowImageViewerProps<T> = {
	readonly imageDescriptions: RBox<readonly T[]>
	readonly makeUrl: (imageDescription: T) => string
	readonly zoomSpeed?: number
	readonly centerOn?: number
	readonly equalizeByHeight?: boolean
	readonly formatLabel?: (img: HTMLImageElement, imageDescription: T) => string
	readonly panBounds?: {
		readonly x: PanBoundsType
		readonly y: PanBoundsType
	}
	/** A fraction of picture that will be used as offset.
	 * 0.1 means that there will be borders of 10% of picture height. */
	readonly defaultOffset?: number
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

	const updateMaxNatHeight = debounce(1, () => {
		const imgArr = imgs().map(([img]) => img)
		let natHeight = maxNatHeight()
		for(const img of imgArr){
			natHeight = Math.max(img.naturalHeight, natHeight)
		}
		maxNatHeight(natHeight)
	})

	const updateBounds = debounce(1, async() => {
		if(updateMaxNatHeight.isRunScheduled){
			await updateMaxNatHeight.waitForScheduledRun() // just in case
		}

		const imgArr = imgs().map(([img]) => img)

		const halfWidth = (window.innerWidth / 2)// * zoom()
		const halfHeight = (window.innerHeight / 2)// * zoom()

		let top = Number.MAX_SAFE_INTEGER,
			bottom = Number.MIN_SAFE_INTEGER,
			left = Number.MAX_SAFE_INTEGER,
			right = Number.MIN_SAFE_INTEGER
		for(const img of imgArr){
			const rect = img.getBoundingClientRect()
			top = Math.min(top, rect.top - halfHeight + yPos())
			bottom = Math.max(bottom, rect.bottom - halfHeight + yPos())
			left = Math.min(left, rect.left - halfWidth + xPos())
			right = Math.max(right, rect.right - halfWidth + xPos())
		}

		const verticalBounds = calculateBoundsForImageViewer({
			min: top, max: bottom,
			borderOffset: (window.innerHeight / 2) * (1 - defaultOffsetZoomMult),
			type: props.panBounds?.y ?? "none", windowSize: window.innerHeight, zoom: zoom()
		})
		const horisontalBounds = calculateBoundsForImageViewer({
			min: left, max: right,
			borderOffset: (window.innerWidth / 2) * (1 - defaultOffsetZoomMult),
			type: props.panBounds?.x ?? "none", windowSize: window.innerWidth, zoom: zoom()
		})
		bounds.top = verticalBounds.min
		bounds.bottom = verticalBounds.max
		bounds.left = horisontalBounds.min
		bounds.right = horisontalBounds.max


		updatePanX()
		updatePanY()
	})

	let defaultZoom = 1
	const zoom = box(defaultZoom)
	const zoomChanger = new SoftValueChanger({
		getValue: zoom,
		setValue: zoom,
		timeMs: 50
	})

	let lastScrollActionCoords: {
		abs: {x: number, y: number}
		rel: {x: number, y: number}
	} | null = null

	function scrollToNextImage(direction: -1 | 1): void {
		const targetIndex = getCentralImageIndex() + direction
		const imgArr = imgs().map(([img]) => img)
		if(targetIndex >= imgArr.length || targetIndex < 0){
			return
		}
		centerOn(imgArr[targetIndex]!)
	}

	function getCentralImageIndex(): number {
		const windowCenter = window.innerWidth / 2
		const imgArr = imgs().map(([img]) => img)
		for(let i = 0; i < imgArr.length; i++){
			const img = imgArr[i]!
			const rect = img.getBoundingClientRect()
			if(rect.left > windowCenter){
				return Math.max(0, i - 1)
			}
		}
		return imgArr.length - 1
	}

	function centerOn(img: HTMLImageElement): void {
		const natHeight = props.equalizeByHeight ? maxNatHeight() : img.naturalHeight
		const natWidth = props.equalizeByHeight ? (img.naturalWidth / img.naturalHeight) * maxNatHeight() : img.naturalWidth
		const hRatio = window.innerHeight / natHeight
		const wRatio = window.innerWidth / natWidth
		defaultZoom = Math.min(1, Math.min(hRatio, wRatio) * defaultOffsetZoomMult)
		zoom(defaultZoom)
		zoomChanger.reset()

		const imgRect = img.getBoundingClientRect()
		const imgLeft = imgRect.left - (window.innerWidth / 2)

		yPos(0)
		xPos(xPos() + imgLeft + (imgRect.width / 2))

		updatePanX()
		updatePanY()
	}

	// scroll view in a way that point of the picture is present at the coords of the screen
	// relPoint is normalized
	function scrollCoordsToPoint(absCoords: {x: number, y: number}, relPoint: {x: number, y: number}): void {
		const width = wrap.scrollWidth * zoom()
		const height = wrap.scrollHeight * zoom()
		const left = -((relPoint.x * width) - absCoords.x)
		const top = -((relPoint.y * height) - absCoords.y)
		xPos(left)
		yPos(top)
	}

	function setZoomByCoords(absCoords: {x: number, y: number}, value: number, instant?: boolean): void {
		absCoords = {...absCoords}
		absCoords.x = (-absCoords.x + (window.innerWidth / 2))
		absCoords.y = (-absCoords.y + (window.innerHeight / 2))
		const relOffsetCoords = {
			x: (absCoords.x - xPos()) / (wrap.scrollWidth * zoom()),
			y: (absCoords.y - yPos()) / (wrap.scrollHeight * zoom())
		}
		lastScrollActionCoords = {abs: absCoords, rel: relOffsetCoords}

		if(instant){
			zoom(value)
			scrollCoordsToPoint(lastScrollActionCoords.abs, lastScrollActionCoords.rel)
		} else {
			zoomChanger.set(value)
		}
	}

	function setZoom(e: MouseEvent | TouchEvent, value: number): void {
		setZoomByCoords(pointerEventsToClientCoords(e), value)
	}

	const imgs = props.imageDescriptions.mapArray(
		desc => props.makeUrl(desc),
		desc => {
			const natSideRatio = box(1)
			const img: HTMLImageElement = tag({
				tag: "img",
				attrs: {src: desc.map(desc => props.makeUrl(desc)), alt: ""},
				style: {
					width: !props.equalizeByHeight ? undefined : viewBox(() => (natSideRatio() * maxNatHeight()) + "px"),
					height: !props.equalizeByHeight ? undefined : maxNatHeight.map(height => height + "px")
				},
				onMousedown: e => {
					if(e.button === 1){
						window.open(props.makeUrl(desc()), "_blank")
					}
				}
			})

			const onLoad = () => {
				natSideRatio(img.naturalWidth / img.naturalHeight)
				updateMaxNatHeight()
				updateBounds()
			}
			if(img.complete){
				onLoad()
			} else {
				// this event listener must not be passive
				// because passive = async call
				// and this could introduce race condition between updateBounds() and centerOn()
				img.addEventListener("load", onLoad, {capture: true, once: true})
			}

			return [img, desc] as const
		}
	)

	const imgsWithLabels = !props.formatLabel ? imgs : imgs.mapArray(
		([img]) => img,
		imgAndDesc => [tag({class: css.imgWrap}, imgAndDesc.map(([img, descBox]) => {
			const label = tag({
				class: css.imgLabel,
				style: {
					fontSize: maxNatHeight.map(height => (height / 400) + "rem")
				}
			}, [])
			waitLoadEvent(img).then(() => label.textContent = props.formatLabel!(img, descBox()))
			whileMounted(label, descBox, desc => label.textContent = props.formatLabel!(img, desc))
			return [img, label]
		})), imgAndDesc()[1]] as const
	)

	const wrap = tag({
		class: [css.imageViewer, {
			[css.grabbed!]: isGrabbed
		}],
		style: {
			transform: zoom.map(zoom => `scale(${zoom})`)
		},
		onClick: () => modal.close()
	}, imgsWithLabels.mapArray(([img]) => img, imgAndDesc => imgAndDesc()[0]))


	const updatePanX = () => {
		const x = xPos()
		const fx = Math.max(bounds.left, Math.min(bounds.right, x))
		if(fx !== x){
			xPos(fx)
			return
		}
		wrap.style.left = (-x + (window.innerWidth / 2)) + "px"
	}

	const updatePanY = () => {
		const y = yPos()
		const fy = Math.max(bounds.top, Math.min(bounds.bottom, y))
		if(fy !== y){
			yPos(fy)
			return
		}
		wrap.style.top = (-y + (window.innerHeight / 2)) + "px"
	}

	// those handlers are only to have better control over updates
	// (i.e. to impose boundaries)
	whileMounted(wrap, xPos, updatePanX)
	whileMounted(wrap, yPos, updatePanY)

	whileMounted(wrap, zoom, () => {
		updateBounds()
		if(lastScrollActionCoords){
			scrollCoordsToPoint(lastScrollActionCoords.abs, lastScrollActionCoords.rel)
		}
	})

	const modal = showModalBase({closeByBackgroundClick: true}, [wrap])

	modal.overlay.addEventListener("wheel", e => {
		e.preventDefault()
		const speed = props.zoomSpeed ?? 0.2
		setZoom(e, zoomChanger.currentTargetValue * (1 + (e.deltaY > 0 ? -speed : speed)))
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
		getZoom: zoom,
		setZoom: (zoomValue, centerCoords) => setZoomByCoords(centerCoords, zoomValue, true)
	})

	onMount(wrap, async() => {
		const targetIndex = props.centerOn ?? 0

		const imgArr = imgs().map(([img]) => img)
		const imgsBeforeTarget = imgArr.slice(0, targetIndex + 1)
		await Promise.all(imgsBeforeTarget.map(img => waitLoadEvent(img)))
		const targetImg = imgArr[targetIndex]!

		await updateBounds.waitForScheduledRun()
		centerOn(targetImg)
	})
}