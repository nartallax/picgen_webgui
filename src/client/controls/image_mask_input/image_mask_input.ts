import {WBox, box, viewBox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {fetchToBox} from "client/client_common/fetch_to_box"
import {windowSizeBox} from "client/client_common/window_size_box"
import {PolygonsInput} from "client/controls/image_mask_input/polygons_input"
import {Modal, showModalBase} from "client/controls/modal_base/modal_base"
import {decodePictureMask, encodePictureMask} from "common/picture_mask_encoding"

interface ImageMaskInputProps {
	imageId: number
	value: WBox<string>
}

interface ImageMaskInputModalControlProps {
	onApply(): void
	onCancel(): void
}

const offsetRatio = 0.9

export function ImageMaskInput(props: ImageMaskInputProps & ImageMaskInputModalControlProps) {
	const imageInfo = fetchToBox(() => ClientApi.getPictureInfoById(props.imageId))

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
			backgroundImage: `url(${JSON.stringify(ClientApi.getPictureUrl(props.imageId))})`
		},
		class: "image-mask-input-background"
	})

	const polygons = box(decodePictureMask(props.value()))
	const polygonsInput = PolygonsInput({
		value: polygons
	})

	function clear(): void {
		polygons([])
	}

	const wrap = tag({
		class: "image-mask-input-wrap"
	}, [
		tag({
			class: "image-mask-input",
			style: {
				width: imageDims.map(wh => wh.width + "px"),
				height: imageDims.map(wh => wh.height + "px")
			}
		}, [background, polygonsInput]),
		tag({class: "image-mask-input-buttons"}, [
			tag({
				tag: "button",
				class: "image-mask-input-button icon-ok",
				onClick: props.onApply
			}, ["Apply"]),
			tag({
				tag: "button",
				class: "image-mask-input-button icon-trash-empty",
				onClick: clear
			}, ["Clear"]),
			tag({
				tag: "button",
				class: "image-mask-input-button icon-cancel",
				onClick: props.onCancel
			}, ["Cancel"])
		])
	])

	whileMounted(wrap, polygons, polygons => {
		props.value(encodePictureMask(polygons))
	})

	return wrap

}

export function showImageMaskInput(opts: ImageMaskInputProps): Modal {
	const preEditValue = opts.value()
	const innerModal: Modal = showModalBase({closeByBackgroundClick: true}, [
		ImageMaskInput({
			...opts,
			onApply: () => innerModal.close(),
			onCancel: () => {
				opts.value(preEditValue)
				innerModal.close()
			}
		})
	])

	return {
		...innerModal,
		waitClose: async() => {
			const closeEvt = await innerModal.waitClose()
			if(closeEvt.reason === "background_click"){
				opts.value(preEditValue)
			}
			return closeEvt
		}
	}
}