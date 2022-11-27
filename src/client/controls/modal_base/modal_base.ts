import {MaybeRBoxed} from "client/base/box"
import {tag} from "client/base/tag"

interface ModalBaseOptions {
	closeByBackgroundClick?: boolean
}

export interface Modal {
	close(): void
	waitClose(): Promise<void>
}

export function showModalBase(opts: ModalBaseOptions, children: MaybeRBoxed<HTMLElement[]>): Modal {
	const result = tag({
		class: ["modal-base", {
			"closeable-by-click": opts.closeByBackgroundClick
		}]
	}, children)

	document.body.appendChild(result)

	let closed = false
	const closeWaiters = [] as (() => void)[]
	function close(): void {
		closed = true
		result.remove()
		const waiters = [...closeWaiters]
		closeWaiters.length = 0
		for(const waiter of waiters){
			waiter()
		}
	}

	function waitClose(): Promise<void> {
		return new Promise(ok => {
			if(closed){
				ok()
			} else {
				closeWaiters.push(ok)
			}
		})
	}

	if(opts.closeByBackgroundClick){
		result.addEventListener("click", e => {
			if(e.target === result){
				close()
			}
		}, {passive: true})
	}


	return {close, waitClose}
}