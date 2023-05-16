import {MRBox, constBoxWrap} from "@nartallax/cardboard"
import {MRBoxed} from "@nartallax/cardboard-dom"
import {Modal, ModalBaseProps, showModalBase} from "client/controls/modal_base/modal_base"
import {SettingsBlock} from "client/controls/settings_block/settings_block"
import {SettingsSubblockHeader} from "client/controls/settings_subblock_header/settings_subblock_header"
import {capitalize} from "common/utils/capitalize"

type Size = string | [string | null, string | null, string | null]

function setSize(el: HTMLElement, baseName: "width" | "height", size: Size): void {
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
	const header = SettingsSubblockHeader({
		header: props.title,
		onClose: () => {
			modal.close()
		}
	})
	const body = SettingsBlock(constBoxWrap(children).map(arr => [header, ...arr]))
	setSize(body, "width", props.width || "300px")
	setSize(body, "height", props.height || "150px")
	const modal = showModalBase(props, [body])
	return modal
}