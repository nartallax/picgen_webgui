import {tag} from "@nartallax/cardboard-dom"
import {showModalBase} from "client/controls/modal_base/modal_base"
import * as css from "./task_picture.module.scss"
import {box} from "@nartallax/cardboard"
import {addMouseDragHandler, pointerEventsToClientCoords, pointerEventsToOffsetCoords} from "client/client_common/mouse_drag"

function waitLoadEvent(img: HTMLImageElement): Promise<void> {
	return new Promise(ok => {
		function onImageLoad(): void {
			img.removeEventListener("load", onImageLoad)
			ok()
		}
		img.addEventListener("load", onImageLoad)
	})
}

const dragSpeed = 3
const zoomSpeed = 0.2

export async function showPictureModal(url: string): Promise<void> {
	const isGrabbed = box(false)
	let natWidth = 1
	let natHeight = 1
	let defaultZoom = 0.0001
	const zoom = box(defaultZoom)

	// scroll view in a way that point of the picture is present at the coords of the screen
	// relPoint is normalized
	function scrollCoordsToPoint(absCoords: {x: number, y: number}, relPoint: {x: number, y: number}): void {
		const width = zoom() * natWidth
		const height = zoom() * natHeight
		wrap.scrollLeft = (relPoint.x * width) - absCoords.x
		wrap.scrollTop = (relPoint.y * height) - absCoords.y
	}

	function setZoom(e: MouseEvent | TouchEvent, value: number): void {
		const absCoords = pointerEventsToClientCoords(e)
		const relOffsetCoords = pointerEventsToOffsetCoords(e)
		if(relOffsetCoords){
			relOffsetCoords.x /= img.clientWidth
			relOffsetCoords.y /= img.clientHeight
		}
		zoom(value)

		if(relOffsetCoords){
			scrollCoordsToPoint(absCoords, relOffsetCoords)
		}
	}

	function toggleZoom(e: MouseEvent | TouchEvent): void {
		setZoom(e, zoom() === 1 ? defaultZoom : 1)
	}

	const img = tag({
		tag: "img",
		attrs: {src: url, alt: ""},
		style: {
			width: zoom.map(zoom => Math.max(1, natWidth * zoom) + "px"),
			height: zoom.map(zoom => Math.max(1, natHeight * zoom) + "px")
		}
	})

	const wrap = tag({
		class: [css.pictureModalWrap, {
			[css.grabbed!]: isGrabbed
		}],
		attrs: {tabindex: 0},
		onClick: e => {
			if(e.target === wrap){
				modal.close()
			}
		}
	}, [img])

	wrap.addEventListener("wheel", e => {
		e.preventDefault()
		setZoom(e, zoom() * (1 + (e.deltaY > 0 ? -zoomSpeed : zoomSpeed)))
	})

	const modal = showModalBase({closeByBackgroundClick: true}, [wrap])

	let prevCoords: {x: number, y: number} | null = null
	let distanceApprox = 0
	addMouseDragHandler({
		element: img,
		start: evt => {
			evt.preventDefault()
			isGrabbed(true)
			distanceApprox = 0
			return true
		},
		downIsMove: true,
		onMove: evt => {
			const coords = pointerEventsToClientCoords(evt)
			if(prevCoords){
				const dx = prevCoords.x - coords.x
				const dy = prevCoords.y - coords.y
				wrap.scrollLeft += dx * dragSpeed
				wrap.scrollTop += dy * dragSpeed
				distanceApprox += Math.abs(dx) + Math.abs(dy)
			}
			prevCoords = coords
		},
		stop: e => {
			prevCoords = null
			if(e instanceof TouchEvent && distanceApprox < 10){
				toggleZoom(e)
			}
			distanceApprox = 0
			isGrabbed(false)
		}
	})

	await waitLoadEvent(img)
	natWidth = img.naturalWidth
	natHeight = img.naturalHeight

	const hRatio = window.innerHeight / natHeight
	const wRatio = window.innerWidth / natWidth
	defaultZoom = Math.min(1, Math.min(hRatio, wRatio) * 0.9)
	zoom(defaultZoom)
}