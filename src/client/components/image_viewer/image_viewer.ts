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
		// this event listener must not be passive
		// because passive = async call
		// and this could introduce race condition between updateBounds() and centerOn()
		img.addEventListener("load", onImageLoad, {passive: true})
	})
}

async function waitLoadAndPaint(img: HTMLImageElement): Promise<void> {
	await waitLoadEvent(img)
	await new Promise<void>((ok, err) => {
		let spinCount = 0
		const cycler = () => {
			if(spinCount > 1000){
				err(new Error("Paint is taking too long"))
			}
			if(img.naturalHeight < 1 || img.clientHeight < 1){
				requestAnimationFrame(cycler)
				spinCount++
			} else {
				ok()
			}
		}
		requestAnimationFrame(cycler)
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

interface RectBounds {
	readonly top: number
	readonly bottom: number
	readonly left: number
	readonly right: number
}

export type ShowImageViewerProps<T> = {
	readonly imageDescriptions: RBox<readonly T[]>
	readonly makeUrl: (imageDescription: T) => string
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
	readonly getAdditionalControls?: (picture: T) => HTMLElement[]
	readonly onScroll?: (args: {x: number, y: number, zoom: number, bounds: RectBounds}) => void
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
		const imgArr = imgs()
		let natHeight = maxNatHeight()
		for(const img of imgArr){
			natHeight = Math.max(img.naturalHeight, natHeight)
		}
		lastKnownHeight = null
		maxNatHeight(natHeight)
	})

	const updateBounds = debounce(1, async() => {
		await updateMaxNatHeight.waitForScheduledRun() // just in case

		const imgArr = imgs()

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
		lastKnownHeight = null
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
		const imgArr = imgs()
		if(targetIndex >= imgArr.length || targetIndex < 0){
			return
		}
		centerOn(imgArr[targetIndex]!)
	}

	function getCentralImageIndex(): number {
		const windowCenter = window.innerWidth / 2
		const imgArr = imgs()
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

	let lastKnownHeight: number | null = null
	function calcZoomnessRate(img: HTMLImageElement): number {
		const height = lastKnownHeight !== null && props.equalizeByHeight
			? lastKnownHeight
			: lastKnownHeight = img.getBoundingClientRect().height
		return height / img.naturalHeight
	}

	const imgsWithLabels = props.imageDescriptions.mapArray(
		desc => props.makeUrl(desc),
		desc => {
			const natSideRatio = box(1)
			const loaded = box(false)
			const widthByHeight = viewBox(() => (natSideRatio() * maxNatHeight()))
			const heightBox = viewBox(() => !loaded() ? null : maxNatHeight() + "px")

			let _img: HTMLImageElement | null = null
			_img = tag({
				tag: "img",
				attrs: {src: desc.map(desc => props.makeUrl(desc)), alt: ""},
				style: {
					width: !props.equalizeByHeight ? undefined : viewBox(() => !loaded() ? null : widthByHeight() + "px"),
					height: !props.equalizeByHeight ? undefined : heightBox,
					imageRendering: zoom.map(() => _img && calcZoomnessRate(_img) >= 1 ? "pixelated" : "auto")
				},
				onMousedown: e => {
					if(e.button === 1){
						window.open(props.makeUrl(desc()), "_blank")
					}
				}
			})
			const img: HTMLImageElement = _img

			waitLoadAndPaint(img).then(() => {
				natSideRatio(img.naturalWidth / img.naturalHeight)
				updateMaxNatHeight()
				updateBounds()
				loaded(true)
			})

			const label = tag({
				class: css.imgLabel,
				style: {
					transform: zoom.map(zoom => `scale(${1 / zoom})`)
				}
			})

			const updateLabel = debounce(1, () => {
				label.textContent = `${img.naturalWidth} x ${img.naturalHeight}, ${(calcZoomnessRate(img) * 100).toFixed(2)}%`
			})
			whileMounted(label, loaded, updateLabel)
			whileMounted(label, zoom, updateLabel)
			whileMounted(label, heightBox, updateLabel)

			let additionalControls: HTMLElement | null = null
			if(props.getAdditionalControls){
				additionalControls = tag({
					class: css.additionalControls,
					style: {
						transform: zoom.map(zoom => `scale(${1 / zoom})`),
						width: viewBox(() => {
							// FIXME: that's not right
							const w = !props.equalizeByHeight ? img.naturalWidth : widthByHeight()
							return (w * zoom()) + "px"
						})
					}
				}, desc.map(desc => props.getAdditionalControls!(desc)))
			}

			// this exists to prevent native browser behaviour about image dragging
			// it will be easier to do with `pointer-events: none` on img
			// but that will also disable image's context menu (this approach will not, on most systems)
			const imgOverlay = tag({class: css.imgOverlay})

			return tag({class: css.imgWrap}, [img, label, additionalControls, imgOverlay])
		}
	)

	const imgs = imgsWithLabels.map(wraps => wraps.map(wrap => wrap.getElementsByTagName("img")[0]!))

	const wrap = tag({
		class: [css.imageViewer],
		style: {
			transform: zoom.map(zoom => `scale(${zoom})`)
		},
		onClick: () => modal.close()
	}, imgsWithLabels)

	const onScrollHandler = debounce(1, () => {
		if(props.onScroll){
			props.onScroll({x: xPos(), y: yPos(), zoom: zoom(), bounds})
		}
	})

	const updatePanX = () => {
		const x = xPos()
		const fx = Math.max(bounds.left, Math.min(bounds.right, x))
		if(fx !== x){
			xPos(fx)
			return
		}
		wrap.style.left = (-x + (window.innerWidth / 2)) + "px"
		onScrollHandler()
	}

	const updatePanY = () => {
		const y = yPos()
		const fy = Math.max(bounds.top, Math.min(bounds.bottom, y))
		if(fy !== y){
			yPos(fy)
			return
		}
		wrap.style.top = (-y + (window.innerHeight / 2)) + "px"
		onScrollHandler()
	}

	// those handlers are only to have better control over updates
	// (i.e. to impose boundaries)
	whileMounted(wrap, xPos, updatePanX)
	whileMounted(wrap, yPos, updatePanY)

	whileMounted(wrap, zoom, () => {
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

		const nowZoom = zoomChanger.currentTargetValue
		let nextZoom = nowZoom * (direction === 1 ? (1 + speed) : (1 / (1 + speed)))

		function willHitZoomBreakpoint(breakpoint: number): boolean {
			if(Math.abs(nowZoom - breakpoint) < 0.001){
				return false // to prevent locking on a breakpoint
			}
			return (nowZoom < breakpoint) === (nextZoom > breakpoint)
		}

		const breakpoints = [
			nowZoom * (1 / currentImageZoomness),
			defaultZoom
		]

		for(const breakpoint of breakpoints){
			if(willHitZoomBreakpoint(breakpoint)){
				nextZoom = breakpoint
				break
			}
		}

		return nextZoom
	}

	modal.overlay.addEventListener("wheel", e => {
		e.preventDefault()
		const centralIndex = getCentralImageIndex()
		const centralImage = imgs()[centralIndex]!
		setZoom(e, getNextZoomValue(
			e.deltaY > 0 ? -1 : 1,
			calcZoomnessRate(centralImage),
			props.zoomSpeed ?? 0.2
		))
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

		const imgArr = imgs()
		const imgsBeforeTarget = imgArr.slice(0, targetIndex + 1)
		await Promise.all(imgsBeforeTarget.map(img => waitLoadAndPaint(img)))
		const targetImg = imgArr[targetIndex]!

		await updateBounds.waitForScheduledRun()
		await updateMaxNatHeight.waitForScheduledRun()
		centerOn(targetImg)
	})
}