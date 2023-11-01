import {bindBox, tag} from "@nartallax/cardboard-dom"
import * as css from "./overlay_item.module.scss"
import {RBox} from "@nartallax/cardboard"

type Corner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight"

type Props = {
	referenceElement: HTMLElement
	body: HTMLElement
	visible: RBox<boolean>
	/** Point of overlay item that will be matched with referencePosition */
	overlayPosition?: Corner
	referencePosition?: Corner
}

type OverlayItem = {
	hide(): void
}

type ParsedCorner = {
	isTop: boolean
	isBottom: boolean
	isLeft: boolean
	isRight: boolean
}

function parseCorner(corner: Corner): ParsedCorner {
	return {
		isTop: corner.startsWith("top"),
		isBottom: corner.startsWith("bottom"),
		isLeft: corner.endsWith("eft"),
		isRight: corner.endsWith("ight")
	}
}

/** Some pop-up item that positioned relative to some other element.
 * Something like a dropdown, or hint. */
export const makeOverlayItem = (props: Props): void => {
	let item: OverlayItem | null = null
	bindBox(props.referenceElement, props.visible, visible => {
		if(item){
			item.hide()
			item = null
		}
		if(visible){
			item = showOverlayItem(props)
		}
	})
}


const showOverlayItem = (props: Props): OverlayItem => {
	const overlayPosition = parseCorner(props.overlayPosition ?? "topLeft")
	const referencePosition = parseCorner(props.referencePosition ?? "topRight")

	const vPadding = tag({class: css.padding})
	const hPadding = tag({class: css.padding})

	function updatePaddings(): void {
		const overlayRect = props.body.getBoundingClientRect()
		const refRect = props.referenceElement.getBoundingClientRect()

		let y = referencePosition.isTop ? refRect.top : refRect.bottom
		if(overlayPosition.isBottom){
			y -= overlayRect.height
		}

		let x = referencePosition.isLeft ? refRect.left : refRect.right
		if(overlayPosition.isRight){
			x -= overlayRect.width
		}

		vPadding.style.height = y + "px"
		hPadding.style.width = x + "px"
	}

	const result = tag({class: css.overlayItemVerticalWrap}, [
		vPadding,
		tag({class: css.overlayItemHorisontalWrap}, [
			hPadding,
			tag({class: css.overlayContentWrap}, [props.body])
		])
	])

	document.body.appendChild(result)
	updatePaddings()
	requestAnimationFrame(() => {
		if(result.parentElement && !result.style.opacity){
			result.style.opacity = "1"
		}
	})

	return {
		hide: () => {
			result.style.opacity = ""
			result.style.pointerEvents = "none"
			setTimeout(() => {
				result.remove()
			}, 250)
		}
	}
}