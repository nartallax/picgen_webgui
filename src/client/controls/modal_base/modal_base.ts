import {MRBox, box} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import * as css from "./modal_base.module.scss"

export interface ModalBaseProps {
	closeByBackgroundClick?: boolean
}

export interface ModalCloseEvent {
	reason: "background_click" | "close_method" | "confirm"
}

export interface Modal {
	close(reason?: ModalCloseEvent["reason"]): void
	waitClose(): Promise<ModalCloseEvent>
}

export function showModalBase(props: ModalBaseProps, children: MRBox<HTMLElement[]>): Modal {
	const isClosed = box(true)

	const result = tag({
		class: [css.modalBase, {
			[css.closeableByClick!]: props.closeByBackgroundClick,
			[css.hidden!]: isClosed
		}]
	}, children)

	document.body.appendChild(result)
	requestAnimationFrame(() => isClosed(false))

	let closeReason: ModalCloseEvent["reason"] | null = null
	const closeWaiters = [] as ((evt: ModalCloseEvent) => void)[]
	function close(reason: ModalCloseEvent["reason"]): void {
		closeReason = reason
		isClosed(true)
		setTimeout(() => result.remove(), 1000)
		const waiters = [...closeWaiters]
		closeWaiters.length = 0
		for(const waiter of waiters){
			waiter({reason})
		}
	}

	function waitClose(): Promise<ModalCloseEvent> {
		return new Promise(ok => {
			if(closeReason){
				ok({reason: closeReason})
			} else {
				closeWaiters.push(ok)
			}
		})
	}

	if(props.closeByBackgroundClick){
		result.addEventListener("click", e => {
			if(e.target === result){
				close("background_click")
			}
		}, {passive: true})
	}


	return {
		close: (reason?: ModalCloseEvent["reason"]) => close(reason ?? "close_method"),
		waitClose
	}
}