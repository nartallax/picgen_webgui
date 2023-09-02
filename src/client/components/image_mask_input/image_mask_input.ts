import {WBox, box, calcBox} from "@nartallax/cardboard"
import {bindBox, onMount, tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {fetchToBox} from "client/client_common/fetch_to_box"
import {PolygonsInput} from "client/components/image_mask_input/polygons_input"
import {Modal, showModalBase} from "client/controls/modal_base/modal_base"
import {decodePictureMask, encodePictureMask} from "common/picture_mask_encoding"
import * as css from "./image_mask_input.module.scss"
import {Icon} from "client/generated/icons"

interface ImageMaskInputProps {
	imageId: number
	imageSalt: number
	value: WBox<string>
}

interface ImageMaskInputModalControlProps {
	onApply(): void
	onCancel(): void
}

const offsetRatio = 0.9

type WH = {width: number, height: number}

function getWindowSize(): WH {
	return {
		width: window.innerWidth,
		height: window.innerHeight
	}
}

export function ImageMaskInput(props: ImageMaskInputProps & ImageMaskInputModalControlProps) {
	const imageInfo = fetchToBox(() => ClientApi.getPictureInfoById(props.imageId, props.imageSalt))

	const winSize = box(getWindowSize())
	const imageDims = calcBox([imageInfo, winSize], (pic, windowSize) => {
		if(!pic){
			return {width: 0, height: 0}
		}

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
			backgroundImage: `url(${JSON.stringify(ClientApi.getPictureUrl(props.imageId, props.imageSalt))})`
		},
		class: "image-mask-input-background"
	})

	const polygons = box(decodePictureMask(props.value.get()))
	const polygonsInput = PolygonsInput({
		value: polygons
	})

	function clear(): void {
		polygons.deleteAllElements()
	}

	const wrap = tag({
		class: css.imageMaskInputWrap
	}, [
		tag({
			class: css.imageMaskInput,
			style: {
				width: imageDims.map(wh => wh.width + "px"),
				height: imageDims.map(wh => wh.height + "px")
			}
		}, [background, polygonsInput]),
		tag({class: css.imageMaskInputButtons}, [
			tag({
				tag: "button",
				class: [css.imageMaskInputButton, Icon.ok],
				onClick: props.onApply
			}, ["Apply"]),
			tag({
				tag: "button",
				class: [css.imageMaskInputButton, Icon.trashEmpty],
				onClick: clear
			}, ["Clear"]),
			tag({
				tag: "button",
				class: [css.imageMaskInputButton, Icon.cancel],
				onClick: props.onCancel
			}, ["Cancel"])
		])
	])

	bindBox(wrap, polygons, polygons => {
		props.value.set(encodePictureMask(polygons))
	})

	onMount(wrap, () => {
		const handler = () => winSize.set(getWindowSize())
		window.addEventListener("resize", handler, {passive: true})
		return () => window.removeEventListener("resize", handler)
	})

	return wrap

}

export function showImageMaskInput(opts: ImageMaskInputProps): Modal {
	const preEditValue = opts.value.get()
	const innerModal: Modal = showModalBase({closeByBackgroundClick: true}, [
		ImageMaskInput({
			...opts,
			onApply: () => innerModal.close(),
			onCancel: () => {
				opts.value.set(preEditValue)
				innerModal.close()
			}
		})
	])

	return {
		...innerModal,
		waitClose: async() => {
			const closeEvt = await innerModal.waitClose()
			if(closeEvt.reason === "background_click"){
				opts.value.set(preEditValue)
			}
			return closeEvt
		}
	}
}