import {MRBox, constBoxWrap} from "@nartallax/cardboard"
import {MRBoxed} from "@nartallax/cardboard-dom"
import {Modal, ModalBaseProps, showModalBase} from "client/controls/modal_base/modal_base"
import {BlockPanel} from "client/components/block_panel/block_panel"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {capitalize} from "common/utils/capitalize"

type Size = string | [string | null, string | null, string | null]

function setSize(el: HTMLElement, baseName: "width" | "height", size: Size | undefined): void {
	if(!size){
		return
	}
	const [min, def, max] = Array.isArray(size) ? size : [null, size, null]
	if(min){
		const prop = "min" + capitalize(baseName) as "minWidth" | "minHeight"
		el.style[prop] = min
	}
	if(def){
		el.style[baseName] = def
	}
	if(max){
		const prop = "max" + capitalize(baseName) as "maxWidth" | "maxHeight"
		el.style[prop] = max
	}
}

type ModalProps = ModalBaseProps & {
	title: MRBoxed<string>
	width?: Size
	height?: Size
}

export function showModal(props: ModalProps, children: MRBox<HTMLElement[]>): Modal {
	const header = BlockPanelHeader({
		header: props.title,
		onClose: () => {
			modal.close()
		}
	})
	const body = BlockPanel(constBoxWrap(children).map(arr => [header, ...arr]))
	setSize(body, "width", props.width)
	setSize(body, "height", props.height)
	const modal = showModalBase(props, [body])
	return modal
}