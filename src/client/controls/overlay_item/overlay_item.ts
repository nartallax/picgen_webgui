import {tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./overlay_item.module.scss"
import {RBox} from "@nartallax/cardboard"

type Corner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight"

type Props = {
	referenceElement: HTMLElement
	body: HTMLElement
	visible: RBox<boolean>
	/** Point of overlay item that will be matched with referencePosition */
	tooltipPosition?: Corner
	referencePosition?: Corner
	canShiftVertically?: boolean
	canShiftHorisonally?: boolean
	zIndex?: number
	parent?: HTMLElement
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
	whileMounted(props.referenceElement, props.visible, visible => {
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
	let nearestRelParent: HTMLElement = document.body
	if(props.parent){
		let el = props.parent
		while(true){
			const pos = window.getComputedStyle(el).position
			if(pos === "relative" || pos === "absolute" || pos === "fixed" || pos === "sticky"){
				nearestRelParent = el
			}
			if(!(el.parentElement instanceof HTMLElement) || el.parentElement === document.body){
				break
			}
			el = el.parentElement
		}
	}

	const rect = props.referenceElement.getBoundingClientRect()
	const parentRect = nearestRelParent.getBoundingClientRect()

	const tooltipPosition = parseCorner(props.tooltipPosition ?? "topLeft")
	const referencePosition = parseCorner(props.referencePosition ?? "topRight")
	const growsLeft = tooltipPosition.isRight
	const growsDown = tooltipPosition.isTop
	const addRefWidth = growsLeft !== referencePosition.isRight
	const addRefHeight = growsDown === referencePosition.isBottom

	const vPadding = tag({
		class: css.padding,
		style: {
			minHeight: props.canShiftVertically ? "0" : undefined,
			flexShrink: props.canShiftVertically ? "1" : undefined,
			height: (rect.top + (addRefHeight ? rect.height : 0)) + "px"
		}
	})

	const hPadding = tag({
		class: css.padding,
		style: {
			minWidth: props.canShiftHorisonally ? "0" : undefined,
			flexShrink: props.canShiftHorisonally ? "1" : undefined,
			width: (rect.left + (addRefWidth ? rect.width : 0)) + "px"
		}
	})

	const result = tag({
		class: css.overlayItemVerticalWrap,
		style: {
			top: (-parentRect.top) + "px",
			left: (-parentRect.left) + "px",
			zIndex: props.zIndex,
			flexDirection: growsDown ? "column" : "column-reverse"
		}
	}, [
		vPadding,
		tag({
			class: css.overlayItemHorisontalWrap,
			style: {
				flexDirection: growsLeft ? "row-reverse" : "row"
			}
		}, [
			hPadding,
			props.body
		])
	]);

	(props.parent ?? document.body).appendChild(result)
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