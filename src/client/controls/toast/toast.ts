import {MaybeRBoxed} from "client/base/box"
import {tag} from "client/base/tag"

interface ToastParams {
	type?: "error" | "info" | "success"
	text: MaybeRBoxed<string>
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
	console.log(`Active toasts count: ${activeToasts}`)
	if(activeToasts === 1){
		toastContainer = tag({class: "toast-container"})
		document.body.appendChild(toastContainer)
		console.log("Toast container added.")
	}
}

function decrementToastCount(): void {
	activeToasts--
	console.log(`Active toasts count: ${activeToasts}`)
	if(activeToasts === 0){
		getToastContainer().remove()
		toastContainer = null
		console.log("Toast container removed.")
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
		class: "toast " + (params.type || "info"),
		on: {click: () => removeToast()}
	}, [tag({
		text: params.text
	})])

	getToastContainer().appendChild(el)
}