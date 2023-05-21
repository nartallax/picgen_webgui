import {onMount, tag} from "@nartallax/cardboard-dom"
import {showModalBase} from "client/controls/modal_base/modal_base"
import * as css from "./image_viewer.module.scss"
import {RBox, box} from "@nartallax/cardboard"
import {pointerEventsToClientCoords} from "client/client_common/mouse_drag"
import {addDragScroll} from "client/client_common/drag_scroll"

function waitLoadEvent(img: HTMLImageElement): Promise<void> {
	return new Promise(ok => {
		function onImageLoad(): void {
			img.removeEventListener("load", onImageLoad)
			ok()
		}
		img.addEventListener("load", onImageLoad)
	})
}

const zoomSpeed = 0.2

export async function showImageViewer(urls: RBox<readonly string[]>): Promise<void> {
	// url = "https://dummyimage.com/5120x5120"
	urls = box(new Array(10).fill(null).map((_, i) => `https://dummyimage.com/25${i}x256`))

	const isGrabbed = box(false)
	let natWidth = 1
	let natHeight = 1
	let defaultZoom = 0.0001
	const zoom = box(defaultZoom)

	// scroll view in a way that point of the picture is present at the coords of the screen
	// relPoint is normalized
	function scrollCoordsToPoint(absCoords: {x: number, y: number}, relPoint: {x: number, y: number}): void {
		console.log(absCoords, relPoint)
		const width = wrap.scrollWidth
		const height = wrap.scrollHeight
		wrap.scrollLeft = (relPoint.x * width) - absCoords.x
		wrap.scrollTop = (relPoint.y * height) - absCoords.y
	}

	function setZoom(e: MouseEvent | TouchEvent, value: number): void {
		const absCoords = pointerEventsToClientCoords(e)
		const relOffsetCoords = {
			x: (absCoords.x + wrap.scrollLeft) / wrap.scrollWidth,
			y: (absCoords.y + wrap.scrollTop) / wrap.scrollHeight
		}
		console.log({absY: absCoords.y, top: wrap.scrollTop, height: wrap.scrollHeight})

		zoom(value)

		if(relOffsetCoords){
			scrollCoordsToPoint(absCoords, relOffsetCoords)
		}
	}

	function toggleZoom(e: MouseEvent | TouchEvent): void {
		const z = zoom()
		setZoom(e, z < defaultZoom ? defaultZoom : z === 1 ? defaultZoom : 1)
	}

	const imgs = urls.mapArray(
		url => url,
		url => tag({
			tag: "img",
			attrs: {src: url, alt: ""},
			style: {
				// width: zoom.map(zoom => Math.max(10, natWidth * zoom) + "px"),
				height: zoom.map(zoom => Math.max(10, natHeight * zoom) + "px"),
				margin: zoom.map(zoom => (zoom * 1) + "rem")
			}
		})
	)

	const wrap = tag({
		class: [css.imageViewer, {
			[css.grabbed!]: isGrabbed
		}],
		attrs: {tabindex: 0},
		onClick: e => {
			if(e.target === wrap){
				modal.close()
			}
		}
	}, imgs)

	const modal = showModalBase({closeByBackgroundClick: true}, [wrap])

	modal.overlay.addEventListener("wheel", e => {
		e.preventDefault()
		setZoom(e, zoom() * (1 + (e.deltaY > 0 ? -zoomSpeed : zoomSpeed)))
	})

	addDragScroll({
		element: wrap,
		isDragging: isGrabbed,
		dragSpeed: 3,
		onClick: toggleZoom
	})

	onMount(wrap, async() => {
		const imgArr = imgs()
		await Promise.any(imgArr.map(img => waitLoadEvent(img)))
		natWidth = imgArr.map(img => img.naturalWidth).reduce((a, b) => a + b, 0)
		natHeight = imgArr.map(img => img.naturalHeight).reduce((a, b) => Math.max(a, b), 0)

		const hRatio = window.innerHeight / natHeight
		const wRatio = window.innerWidth / natWidth
		defaultZoom = Math.min(1, Math.min(hRatio, wRatio) * 0.9)
		zoom(defaultZoom)
	})
}