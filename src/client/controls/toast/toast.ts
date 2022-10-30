import {getBinder} from "client/base/binder/binder"
import {MaybeRBoxed} from "client/base/box"
import {getNowBox} from "client/base/now_box"
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
	if(activeToasts === 1){
		toastContainer = tag({class: "toast-container"})
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

	const now = getNowBox()
	const startTime = now()
	const timeoutSeconds = params.timeoutSeconds ?? 15000000000

	function removeToast(): void {
		el.remove()
		decrementToastCount()
	}

	const el = tag({
		class: "toast " + (params.type || "info"),
		on: {click: () => removeToast()}
	}, [tag({
		text: params.text
	})])

	const binder = getBinder(el)
	binder.watch(now, now => {
		if(Math.floor((now - startTime) / 1000) >= timeoutSeconds){
			removeToast()
		}
	})

	getToastContainer().appendChild(el)
}