import {MaybeRBoxed} from "client/base/box"
import {tag} from "client/base/tag"

interface ModalBaseOptions {
	closeByBackgroundClick?: boolean
}

export function showModalBase(opts: ModalBaseOptions, children: MaybeRBoxed<HTMLElement[]>): () => void {
	const result = tag({
		class: ["modal-base", {
			"closeable-by-click": opts.closeByBackgroundClick
		}]
	}, children)

	document.body.appendChild(result)

	function close(): void {
		result.remove()
	}

	if(opts.closeByBackgroundClick){
		result.addEventListener("click", e => {
			if(e.target === result){
				close()
			}
		}, {passive: true})
	}

	return close
}