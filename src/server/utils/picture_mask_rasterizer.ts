import {PNG} from "pngjs"
import * as Fs from "fs"
import {PictureMask, Point2D, Polygon} from "common/entities/picture"

type Line = {
	// it is implied that `from` always has smaller or equal Y than `to`
	from: Point2D
	to: Point2D
	inclination: number
	inverted: boolean
}

type WH = {width: number, height: number}

type Intersection = {coord: number, up: boolean}

export async function rasterizePictureMask(mask: PictureMask, path: string, size: {width: number, height: number}): Promise<void> {
	const png = new PNG({
		width: size.width,
		height: size.height,
		bitDepth: 8,
		colorType: 0,
		inputColorType: 0,
		filterType: 0,
		inputHasAlpha: false,
		skipRescale: true,
		deflateLevel: 1
	})

	for(let y = 0; y < size.height; y++){
		let offset = size.width * y
		for(let x = 0; x < size.height; x++){
			png.data[offset++] = 0xff
		}
	}

	for(const polygon of mask){
		const {lines, min, max} = preparePolygon(polygon, size)
		for(let y = min.y; y <= max.y; y++){
			const rowOffset = size.width * y
			const intersections = findLineIntersectionsFor(lines, y)
			let depth = 0
			for(let i = 0; i < intersections.length - 1; i++){
				const intersection = intersections[i]!
				depth += intersection.up ? 1 : -1
				if(depth !== 0){
					const nextIntersection = intersections[i + 1]!
					if(!nextIntersection){
						// not gonna happen?
						// because it doesn't make sense to have depth !== 0 while having no more intersections
						break
					}
					const start = rowOffset + intersection.coord
					const limit = rowOffset + nextIntersection.coord
					for(let offset = start; offset <= limit; offset++){
						png.data[offset] = 0x00
					}
				}
			}
		}
	}

	await pipeAndWait(png, path)
}

function findLineIntersectionsFor(lines: Line[], y: number): Intersection[] {
	let result: Intersection[] = []
	for(const line of lines){
		if(line.to.y < y || line.from.y >= y){
			continue
		}
		const intersectionX = line.from.x - (line.inclination * (line.from.y - y))
		if(Number.isFinite(intersectionX)){
			result.push({
				coord: Math.floor(intersectionX),
				up: line.inverted
			})
		}
	}
	result = result.sort((a, b) => a.coord - b.coord)
	return result
}

function preparePolygon(polygon: Polygon, size: WH): {lines: Line[], min: Point2D, max: Point2D} {
	if(polygon.length < 3){
		return {lines: [], min: {x: 0, y: 0}, max: {x: 0, y: 0}}
	}

	const lines: Line[] = []
	const min = {x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER}
	const max = {x: -1, y: -1}

	for(let i = 1; i < polygon.length; i++){
		lines.push(makeLine(polygon[i - 1]!, polygon[i]!, size, min, max))
	}
	lines.push(makeLine(polygon[polygon.length - 1]!, polygon[0]!, size, min, max))

	lines.sort((a, b) => a.from.y - b.from.y)

	return {lines, min, max}
}

function makeLine(a: Point2D, b: Point2D, size: WH, min: Point2D, max: Point2D): Line {
	let from = {
		x: Math.floor(a.x * size.width),
		y: Math.floor(a.y * size.height)
	}

	let to = {
		x: Math.floor(b.x * size.width),
		y: Math.floor(b.y * size.height)
	}

	if(from.x > max.x){
		max.x = from.x
	}
	if(from.y > max.y){
		max.y = from.y
	}
	if(from.x < min.x){
		min.x = from.x
	}
	if(from.y < min.y){
		min.y = from.y
	}

	let inverted = false
	if(from.y > to.y){
		const tmp = from
		from = to
		to = tmp
		inverted = true
	}

	return {
		from, to,
		inclination: (b.x - a.x) / (b.y - a.y),
		inverted
	}
}

function pipeAndWait(png: PNG, path: string): Promise<void> {
	return new Promise((ok, bad) => {
		const outStream = Fs.createWriteStream(path)
		const pngStream = png.pack()
		pngStream.pipe(outStream)
		outStream.on("error", e => bad(e))
		pngStream.on("error", e => bad(e))
		outStream.on("close", () => ok())
	})
}