import {onMount, tag} from "@nartallax/cardboard-dom"
import {showModalBase} from "client/controls/modal_base/modal_base"
import * as css from "./image_viewer.module.scss"
import {RBox, box, viewBox} from "@nartallax/cardboard"
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

function natHeightBox(getImg: () => HTMLImageElement): RBox<number> {
	const result = box(0)
	requestAnimationFrame(() => {
		const img = getImg()
		waitLoadEvent(img).then(() => result(img.naturalHeight))
	})
	return result
}

const zoomSpeed = 0.2

export async function showImageViewer(urls: RBox<readonly string[]>): Promise<void> {
	// url = "https://dummyimage.com/5120x5120"
	urls = box(new Array(10).fill(null).map((_, i) => `https://dummyimage.com/256x${i + 1}00`))

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

	// scroll view in a way that point of the picture is present at the coords of the screen
	// relPoint is normalized
	function scrollCoordsToPoint(absCoords: {x: number, y: number}, relPoint: {x: number, y: number}): void {
		const width = wrap.scrollWidth
		const height = wrap.scrollHeight
		const left = -((relPoint.x * width) - absCoords.x)
		const top = -((relPoint.y * height) - absCoords.y)
		wrap.style.left = left + "px"
		wrap.style.top = top + "px"
	}

	function setZoom(e: MouseEvent | TouchEvent, value: number): void {
		const absCoords = pointerEventsToClientCoords(e)
		const relOffsetCoords = {
			x: (absCoords.x - parseFloat(wrap.style.left || "0")) / wrap.scrollWidth,
			y: (absCoords.y - parseFloat(wrap.style.top || "0")) / wrap.scrollHeight
		}
		lastScrollActionCoords = {abs: absCoords, rel: relOffsetCoords}
		// console.log(absCoords, relOffsetCoords)

		zoomChanger.set(value)
	}

	function toggleZoom(e: MouseEvent | TouchEvent): void {
		const z = zoomChanger.currentTargetValue
		setZoom(e, z < defaultZoom ? defaultZoom : z === 1 ? defaultZoom : 1)
	}

	const imgs = urls.mapArray(
		url => url,
		url => {
			const natHeight = natHeightBox(() => result)
			const result: HTMLImageElement = tag({
				tag: "img",
				attrs: {src: url, alt: ""},
				style: {
					height: viewBox(() => Math.max(10, natHeight() * zoom()) + "px"),
					margin: zoom.map(zoom => (zoom * 1) + "rem")
				}
			})
			return result
		}
	)

	const wrap = tag({
		class: [css.imageViewer, {
			[css.grabbed!]: isGrabbed
		}],
		onClick: e => {
			if(e.target === wrap){
				modal.close()
			}
		}
	}, imgs)

	const modal = showModalBase({closeByBackgroundClick: true}, [wrap])

	modal.overlay.addEventListener("wheel", e => {
		e.preventDefault()
		setZoom(e, zoomChanger.currentTargetValue * (1 + (e.deltaY > 0 ? -zoomSpeed : zoomSpeed)))
	})

	addDragScroll({
		element: modal.overlay,
		draggedElement: wrap,
		isDragging: isGrabbed,
		dragSpeed: 3,
		onClick: toggleZoom,
		absPosScroll: true
	})

	onMount(wrap, async() => {
		const imgArr = imgs()
		await Promise.any(imgArr.map(img => waitLoadEvent(img)))
		const maxNatWidth = imgArr.map(img => img.naturalWidth).reduce((a, b) => Math.max(a, b), 0)
		const maxNatHeight = imgArr.map(img => img.naturalHeight).reduce((a, b) => Math.max(a, b), 0)

		const hRatio = window.innerHeight / maxNatHeight
		const wRatio = window.innerWidth / maxNatWidth
		defaultZoom = Math.min(1, Math.min(hRatio, wRatio) * 0.9)
		zoom(defaultZoom)
		zoomChanger.reset()
	})
}