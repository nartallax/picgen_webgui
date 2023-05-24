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

type Props = {
	urls: RBox<readonly string[]>
	zoomSpeed?: number
	centerOn?: number
	equalizeByHeight?: boolean
}

export async function showImageViewer(props: Props): Promise<void> {
	// url = "https://dummyimage.com/5120x5120"
	props.urls = props.urls.map(urls => urls.map((_, i) => `https://dummyimage.com/256x${i + 1}00`))

	const isGrabbed = box(false)
	// coords of center of the screen in "image space"
	const xPos = box(0)
	const yPos = box(0)

	const maxNatHeight = box(0)

	let bounds: {top: number, bottom: number, left: number, right: number} | null = null

	const updateBounds = debounce(0, () => {
		if(!bounds){
			bounds = {
				top: Number.MAX_SAFE_INTEGER,
				bottom: Number.MIN_SAFE_INTEGER,
				left: Number.MAX_SAFE_INTEGER,
				right: Number.MIN_SAFE_INTEGER
			}
		}

		let natHeight = maxNatHeight()
		for(const img of imgs()){
			natHeight = Math.max(img.naturalHeight, natHeight)
		}
		maxNatHeight(natHeight)

		for(const img of imgs()){
			const rect = img.getBoundingClientRect()
			bounds.top = Math.min(bounds.top, -rect.height / 2)
			bounds.bottom = Math.max(bounds.bottom, rect.height / 2)
			bounds.left = Math.min(bounds.left, (rect.left / zoom()) - (window.innerWidth / 2) + xPos())
			bounds.right = Math.max(bounds.right, (rect.right / zoom()) - (window.innerWidth / 2) + xPos())
		}
	})

	let defaultZoom = 1
	const zoom = box(defaultZoom)
	const zoomChanger = new SoftValueChanger({
		getValue: zoom,
		setValue: zoom,
		timeMs: 50,
		onChange: () => {
			if(lastScrollActionCoords){
				scrollCoordsToPoint(lastScrollActionCoords.abs, lastScrollActionCoords.rel)
			}
		}
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

	// FIXME
	const center = tag({style: {
		width: "10px",
		height: "10px",
		backgroundColor: "red",
		position: "absolute",
		left: ((window.innerWidth / 2) - 5) + "px",
		top: ((window.innerHeight / 2) - 5) + "px"
	}})
	document.body.appendChild(center)

	function centerOn(img: HTMLImageElement): void {
		const natHeight = props.equalizeByHeight ? maxNatHeight() : img.naturalHeight
		const natWidth = props.equalizeByHeight ? (img.naturalWidth / img.naturalHeight) * maxNatHeight() : img.naturalWidth
		const hRatio = window.innerHeight / natHeight
		const wRatio = window.innerWidth / natWidth
		defaultZoom = Math.min(1, Math.min(hRatio, wRatio) * 0.9)
		zoom(defaultZoom)
		zoomChanger.reset()

		const imgRect = img.getBoundingClientRect()
		const imgLeft = imgRect.left - (window.innerWidth / 2)

		yPos(0)
		xPos(xPos() + imgLeft + (imgRect.width / 2))
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

	const imgs = props.urls.mapArray(
		url => url,
		url => {
			const natSideRatio = box(1)
			const img: HTMLImageElement = tag({
				tag: "img",
				attrs: {src: url, alt: ""},
				style: {
					width: !props.equalizeByHeight ? undefined : viewBox(() => (natSideRatio() * maxNatHeight()) + "px"),
					height: !props.equalizeByHeight ? undefined : maxNatHeight.map(height => height + "px")
				},
				onMousedown: e => {
					if(e.button === 1){
						window.open(url(), "_blank")
					}
				}
			})

			const onLoad = () => {
				natSideRatio(img.naturalWidth / img.naturalHeight)
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

			return img
		}
	)

	const wrap = tag({
		class: [css.imageViewer, {
			[css.grabbed!]: isGrabbed
		}],
		style: {
			transform: zoom.map(zoom => `scale(${zoom})`)
		},
		onClick: () => modal.close()
	}, imgs)

	// those handlers are only to have better control over updates
	// (i.e. to impose boundaries)
	whileMounted(wrap, xPos, x => {
		if(bounds){
			const fx = Math.max(bounds.left * zoom(), Math.min(bounds.right * zoom(), x))
			if(fx !== x){
				xPos(fx)
				return
			}
		}
		wrap.style.left = (-x + (window.innerWidth / 2)) + "px"
	})

	whileMounted(wrap, yPos, y => {
		if(bounds){
			const fy = Math.max(bounds.top * zoom(), Math.min(bounds.bottom * zoom(), y))
			if(fy !== y){
				yPos(fy)
				return
			}
		}
		wrap.style.top = (-y + (window.innerHeight / 2)) + "px"
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

		const imgArr = imgs()
		const imgsBeforeTarget = imgArr.slice(0, targetIndex + 1)
		await Promise.all(imgsBeforeTarget.map(img => waitLoadEvent(img)))
		const targetImg = imgArr[targetIndex]!

		await updateBounds.waitForScheduledRun()
		centerOn(targetImg)
	})
}