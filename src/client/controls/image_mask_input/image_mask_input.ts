import {ClientApi} from "client/app/client_api"
import {getBinder} from "client/base/binder/binder"
import {box, viewBox, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {fetchToBox} from "client/client_common/fetch_to_box"
import {windowSizeBox} from "client/client_common/window_size_box"
import {PolygonsInput} from "client/controls/image_mask_input/polygons_input"
import {Modal, showModalBase} from "client/controls/modal_base/modal_base"
import {decodePictureMask, encodePictureMask} from "common/picture_mask_encoding"

interface ImageMaskInputOptions {
	imageId: number
	value: WBox<string>
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
			backgroundImage: `url(${JSON.stringify(ClientApi.getPictureUrl(opts.imageId))})`
		},
		class: "image-mask-input-background"
	})

	const polygons = box(decodePictureMask(opts.value()))
	const polygonsInput = PolygonsInput({
		value: polygons
	})

	const wrap = tag({
		class: "image-mask-input-wrap"
	}, [tag({
		class: "image-mask-input",
		style: {
			width: imageDims.map(wh => wh.width + "px"),
			height: imageDims.map(wh => wh.height + "px")
		}
	}, [background, polygonsInput])])

	const binder = getBinder(wrap)
	binder.watch(polygons, polygons => {
		opts.value(encodePictureMask(polygons))
	})

	return wrap

}

export function showImageMaskInput(opts: ImageMaskInputOptions): Modal {
	return showModalBase({closeByBackgroundClick: true}, [
		ImageMaskInput(opts)
	])
}