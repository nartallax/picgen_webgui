import {MRBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"

interface ModalBaseProps {
	closeByBackgroundClick?: boolean
}

export interface ModalCloseEvent {
	reason: "background_click" | "close_method"
}

export interface Modal {
	close(): void
	waitClose(): Promise<ModalCloseEvent>
}

export function showModalBase(props: ModalBaseProps, children: MRBox<HTMLElement[]>): Modal {
	const result = tag({
		class: ["modal-base", {
			"closeable-by-click": props.closeByBackgroundClick
		}]
	}, children)

	document.body.appendChild(result)

	let closeReason: ModalCloseEvent["reason"] | null = null
	const closeWaiters = [] as ((evt: ModalCloseEvent) => void)[]
	function close(reason: ModalCloseEvent["reason"]): void {
		closeReason = reason
		result.remove()
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


	return {close: () => close("close_method"), waitClose}
}