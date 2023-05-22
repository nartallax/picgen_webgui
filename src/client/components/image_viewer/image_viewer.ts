import {onMount, tag} from "@nartallax/cardboard-dom"
import {showModalBase} from "client/controls/modal_base/modal_base"
import * as css from "./image_viewer.module.scss"
import {RBox, box} from "@nartallax/cardboard"
import {pointerEventsToClientCoords} from "client/client_common/mouse_drag"
import {addDragScroll} from "client/client_common/drag_scroll"
import {SoftValueChanger} from "client/base/soft_value_changer"

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
}

export async function showImageViewer(props: Props): Promise<void> {
	// url = "https://dummyimage.com/5120x5120"
	// props.urls = props.urls.map(urls => urls.map((_, i) => `https://dummyimage.com/2560x${i + 1}00`))

	const isGrabbed = box(false)

	let defaultZoom = 0.0001
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

	function centerOn(targetImg: HTMLImageElement): void {
		const hRatio = window.innerHeight / targetImg.naturalHeight
		const wRatio = window.innerWidth / targetImg.naturalWidth
		defaultZoom = Math.min(1, Math.min(hRatio, wRatio) * 0.9)
		zoom(defaultZoom)
		zoomChanger.reset()

		const imgRect = targetImg.getBoundingClientRect()
		const containerOffsetTop = imgRect.top - parseFloat(wrap.style.top || "0")
		const containerOffsetLeft = imgRect.left - parseFloat(wrap.style.left || "0")
		const windowOffsetTop = (window.innerHeight - imgRect.height) / 2
		const windowOffsetLeft = (window.innerWidth - imgRect.width) / 2

		wrap.style.top = (windowOffsetTop - containerOffsetTop) + "px"
		wrap.style.left = (windowOffsetLeft - containerOffsetLeft) + "px"
	}

	// scroll view in a way that point of the picture is present at the coords of the screen
	// relPoint is normalized
	function scrollCoordsToPoint(absCoords: {x: number, y: number}, relPoint: {x: number, y: number}): void {
		const width = wrap.scrollWidth * zoom()
		const height = wrap.scrollHeight * zoom()
		const left = -((relPoint.x * width) - absCoords.x)
		const top = -((relPoint.y * height) - absCoords.y)
		wrap.style.left = left + "px"
		wrap.style.top = top + "px"
	}

	function setZoom(e: MouseEvent | TouchEvent, value: number): void {
		const absCoords = pointerEventsToClientCoords(e)
		const relOffsetCoords = {
			x: (absCoords.x - parseFloat(wrap.style.left || "0")) / (wrap.scrollWidth * zoom()),
			y: (absCoords.y - parseFloat(wrap.style.top || "0")) / (wrap.scrollHeight * zoom())
		}
		lastScrollActionCoords = {abs: absCoords, rel: relOffsetCoords}

		zoomChanger.set(value)
	}

	function toggleZoom(e: MouseEvent | TouchEvent): void {
		const z = zoomChanger.currentTargetValue
		setZoom(e, z < defaultZoom ? defaultZoom : z === 1 ? defaultZoom : 1)
	}

	const imgs = props.urls.mapArray(
		url => url,
		url => {
			const result: HTMLImageElement = tag({
				tag: "img",
				attrs: {src: url, alt: ""}
			})
			return result
		}
	)

	const wrap = tag({
		class: [css.imageViewer, {
			[css.grabbed!]: isGrabbed
		}],
		style: {
			transform: zoom.map(zoom => `scale(${zoom})`)
		}
	}, imgs)

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
		element: modal.overlay,
		draggedElement: wrap,
		isDragging: isGrabbed,
		dragSpeed: 2,
		onClick: toggleZoom,
		absPosScroll: true
	})

	onMount(wrap, async() => {
		const targetIndex = props.centerOn ?? 0

		const imgArr = imgs()
		const imgsBeforeTarget = imgArr.slice(0, targetIndex + 1)
		await Promise.all(imgsBeforeTarget.map(img => waitLoadEvent(img)))
		const targetImg = imgArr[targetIndex]!

		centerOn(targetImg)
	})
}