import {ClientApi} from "client/app/client_api"
import {viewBox, WBox} from "client/base/box"
import {svgTag, tag} from "client/base/tag"
import {fetchToBox} from "client/client_common/fetch_to_box"
import {windowSizeBox} from "client/client_common/window_size_box"
import {showModalBase} from "client/controls/modal_base/modal_base"
import {PictureMask, Point2D} from "common/common_types"

interface ImageMaskInputOptions {
	imageId: number
	value: WBox<PictureMask>
}

const offsetRatio = 0.9

export function ImageMaskInput(opts: ImageMaskInputOptions) {
	const imageInfo = fetchToBox(() => ClientApi.getPictureInfoById(opts.imageId))
	const winSize = windowSizeBox()
	const imageDims = viewBox(() => {
		const pic = imageInfo()
		if(!pic){
			return {width: 0, height: 0}
		}

		const windowSize = winSize()
		const limWidth = windowSize.width * offsetRatio
		const limHeight = windowSize.height * offsetRatio
		let width = pic.width
		let height = pic.height
		if(width > limWidth){
			const ratio = limWidth / width
			width *= ratio
			height *= ratio
		}
		if(height > limHeight){
			const ratio = limHeight / width
			width *= ratio
			height *= ratio
		}

		return {
			width: Math.floor(width),
			height: Math.floor(height)
		}
	})

	const background = tag({
		style: {
			backgroundImage: ClientApi.getPictureUrl(opts.imageId)
		},
		class: "image-mask-input-background"
	})

	let line: SVGElement | null = null
	const linePoints: Point2D[] = []

	function addPointToLine(evt: MouseEvent): void {
		line ||= svgTag({
			tagName: "path",
			class: "line"
		})
		let d = line.getAttribute("d") || ""

		const rect = svg.getBoundingClientRect()
		const x = (rect.x - evt.clientX) / rect.width
		const y = (rect.y - evt.clientY) / rect.height

		d += `M ${x} ${y}`
		linePoints.push({x, y})

		line.setAttribute("d", d)
	}

	const svg = svgTag({
		tagName: "svg",
		attrs: {
			x: "0",
			y: "0",
			width: "1",
			height: "1",
			viewBox: "0 0 1 1"
		},
		on: {
			click: addPointToLine
		}
	})

	const wrap = tag({
		class: "image-mask-input",
		style: {
			width: imageDims.map(wh => wh.width + "px"),
			height: imageDims.map(wh => wh.height + "px")
		}
	}, [background, svg])

	return wrap

}

export function showImageMaskInput(opts: ImageMaskInputOptions): () => void {
	return showModalBase({closeByBackgroundClick: true}, [
		ImageMaskInput(opts)
	])
}