import {getBinder} from "client/base/binder/binder"
import {WBox} from "client/base/box"
import {svgTag} from "client/base/tag"
import {Point2D, Polygon} from "common/common_types"

interface PolygonsInputOptions {
	value: WBox<Polygon[]>
}

const segmentDistanceLimitPx = 25
const segmentDistanceLimitPxSquared = segmentDistanceLimitPx ** 2

export function PolygonsInput(opts: PolygonsInputOptions): Element {

	let currentPolygonElement: SVGElement | null = null
	const currentPolygon: Point2D[] = []

	function normalizePoint(point: Point2D): Point2D {
		const rect = svg.getBoundingClientRect()
		return {
			x: (point.x - rect.x) / rect.width,
			y: (point.y - rect.y) / rect.height
		}
	}

	function denormalizePoint(point: Point2D): Point2D {
		const rect = svg.getBoundingClientRect()
		return {
			x: (point.x * rect.width) + rect.x,
			y: (point.y * rect.height) + rect.y
		}
	}

	function makeNewPolygonElement(): void {
		currentPolygonElement = svgTag({tagName: "path", class: "polygon"})
		svg.appendChild(currentPolygonElement)
	}

	function finalizeCurrentPolygonElement(): void {
		currentPolygonElement = null
	}

	function removeAllPolygonElements(): void {
		while(svg.lastChild){
			svg.lastChild.remove()
		}
	}

	function addPointToCurrentPolygonElement(point: Point2D): void {
		if(!currentPolygonElement){
			throw new Error("Cannot add point to polygon: no polygon")
		}
		let d = currentPolygonElement.getAttribute("d") || "Z"

		d = d.substring(0, d.length - 1) + (d.length < 2 ? "M" : "L") + ` ${point.x} ${point.y} Z`
		currentPolygonElement.setAttribute("d", d)
	}

	function onStart(evt: MouseEvent | TouchEvent): void {
		makeNewPolygonElement()
		const point = normalizePoint(coordsFromEvent(evt))
		addPointToCurrentPolygonElement(point)
		currentPolygon.push(point)

		svg.addEventListener("mousemove", onMove)
		svg.addEventListener("touchmove", onMove)
		window.addEventListener("mouseup", onEnd)
		window.addEventListener("touchend", onEnd)
	}

	function onEnd(): void {
		svg.removeEventListener("mousemove", onMove)
		svg.removeEventListener("touchmove", onMove)
		window.removeEventListener("mouseup", onEnd)
		window.removeEventListener("touchend", onEnd)
		finalizeCurrentPolygonElement()
		opts.value([
			...opts.value(),
			[...currentPolygon]
		])
		currentPolygon.length = 0
	}

	function onMove(evt: MouseEvent | TouchEvent): void {
		const lastPointNorm = currentPolygon[currentPolygon.length - 1]
		if(!lastPointNorm){
			return
		}
		const lastPointScreen = denormalizePoint(lastPointNorm)
		const coords = coordsFromEvent(evt)
		const d2 = distanceSquared(lastPointScreen, coords)
		if(d2 >= segmentDistanceLimitPxSquared){
			const point = normalizePoint(coords)
			addPointToCurrentPolygonElement(point)
			currentPolygon.push(point)
		}
	}

	function onKey(evt: KeyboardEvent): void {
		if(evt.key === "z" && (evt.ctrlKey || evt.metaKey)){
			const polygons = [...opts.value()]
			polygons.pop()
			opts.value(polygons)
		}
	}

	const svg = svgTag({
		tagName: "svg",
		class: "polygons-input",
		attrs: {
			x: "0",
			y: "0",
			width: "1",
			height: "1",
			viewBox: "0 0 1 1"
		},
		on: {
			mousedown: onStart,
			touchstart: onStart
		}
	})

	const binder = getBinder(svg)
	binder.onNodeInserted(() => {
		window.addEventListener("keydown", onKey)
	})
	binder.onNodeRemoved(() => {
		window.removeEventListener("keydown", onKey)
	})

	binder.watchAndRun(opts.value, polygons => {
		requestAnimationFrame(() => {
			console.log(polygons)
			removeAllPolygonElements() // eww.
			for(const polygon of polygons){
				makeNewPolygonElement()
				for(const point of polygon){
					addPointToCurrentPolygonElement(point)
				}
				finalizeCurrentPolygonElement()
			}
		})
	})

	return svg

}

function distanceSquared(a: Point2D, b: Point2D): number {
	const dx = a.x - b.x
	const dy = a.y - b.y
	return (dx * dx) + (dy * dy)
}

function isTouchEvent(evt: MouseEvent | TouchEvent): evt is TouchEvent {
	return !!(evt as TouchEvent).touches
}

function coordsFromEvent(evt: MouseEvent | TouchEvent): Point2D {
	if(isTouchEvent(evt)){
		const firstTouch = evt.touches[0]
		if(!firstTouch){
			throw new Error("There's no touches in touch event! Cannot extract coords.")
		}
		return {x: firstTouch.clientX, y: firstTouch.clientY}
	} else {
		return {x: evt.clientX, y: evt.clientY}
	}
}