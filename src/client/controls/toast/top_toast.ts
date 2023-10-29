import {MRBox, box} from "@nartallax/cardboard"
import {makeOverlayItem} from "client/controls/overlay_item/overlay_item"
import * as css from "./toast.module.scss"
import {tag} from "@nartallax/cardboard-dom"

interface Props {
	text: MRBox<string>
	timeMs: number
}

export interface TopToast {
	remove(): void
}

export function showTopToast(props: Props): TopToast {
	const isVisible = box(true)
	setTimeout(() => isVisible.set(false), props.timeMs)
	makeOverlayItem({
		referenceElement: document.body,
		body: tag({class: css.topToastWrap}, [
			tag({class: css.topToast}, [props.text])
		]),
		visible: isVisible,
		overlayPosition: "topLeft",
		referencePosition: "topLeft"
	})

	return {
		remove: () => isVisible.set(false)
	}
}