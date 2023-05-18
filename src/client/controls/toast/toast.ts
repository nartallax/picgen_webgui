import {MRBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import * as css from "./toast.module.scss"

interface ToastParams {
	type?: "error" | "info" | "success"
	text: MRBox<string>
	timeoutSeconds?: number
}

let toastContainer: HTMLElement | null = null
let activeToasts = 0

function getToastContainer(): HTMLElement {
	if(toastContainer === null){
		throw new Error("Toast state is incorrect")
	}
	return toastContainer
}

function incrementToastCount(): void {
	activeToasts++
	if(activeToasts === 1){
		toastContainer = tag({class: css.toastContainer})
		document.body.appendChild(toastContainer)
	}
}

function decrementToastCount(): void {
	activeToasts--
	if(activeToasts === 0){
		getToastContainer().remove()
		toastContainer = null
	}
}

export function showToast(params: ToastParams): void {
	incrementToastCount()

	const timeoutSeconds = params.timeoutSeconds ?? 15

	const timeoutHandle = setTimeout(removeToast, timeoutSeconds * 1000)

	function removeToast(): void {
		el.remove()
		clearTimeout(timeoutHandle)
		decrementToastCount()
	}

	const el = tag({
		class: [css.toast, css[params.type || "info"]],
		onClick: () => removeToast()
	}, [params.text])

	getToastContainer().appendChild(el)
}