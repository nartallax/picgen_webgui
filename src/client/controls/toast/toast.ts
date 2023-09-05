import {MRBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import * as css from "./toast.module.scss"
import {toastCountLimit, toastDurationOverride} from "client/app/global_values"

interface ToastParams {
	type?: "error" | "info" | "success"
	text: MRBox<string>
	timeoutSeconds?: number
}

let toastContainer: HTMLElement | null = null

function getToastContainer(): HTMLElement {
	if(toastContainer === null){
		throw new Error("Toast state is incorrect")
	}
	return toastContainer
}

function addToastToList(toast: Toast): void {
	activeToasts.push(toast)
	if(activeToasts.length === 1 && !toastContainer){
		toastContainer = tag({class: css.toastContainer})
		document.body.appendChild(toastContainer)
	}
}

function removeToastFromList(toast: Toast): void {
	activeToasts = activeToasts.filter(x => x !== toast)
	if(activeToasts.length === 0 && toastContainer){
		toastContainer.remove()
		toastContainer = null
	}
}

interface Toast {
	remove(): void
	show(): void
}

let activeToasts: Toast[] = []

function dropExcessToasts(): void {
	const limit = toastCountLimit.get()
	if(limit < 0){
		return
	}
	while(activeToasts.length > limit){
		const firstToast = activeToasts[0]!
		firstToast.remove()
	}
}

function makeToast(params: ToastParams): Toast {
	const el = tag({
		class: [css.toast, css[params.type || "info"]],
		onClick: () => remove()
	}, [params.text])

	let timeoutSeconds = toastDurationOverride.get()
	if(timeoutSeconds < 0){
		timeoutSeconds = params.timeoutSeconds ?? 15
	}

	let timeoutHandle: ReturnType<typeof setTimeout> | null = null

	function show(): void {
		addToastToList(toast)
		getToastContainer().appendChild(el)
		timeoutHandle = setTimeout(remove, timeoutSeconds * 1000)
		dropExcessToasts()
	}

	function remove(): void {
		el.remove()
		if(timeoutHandle !== null){
			clearTimeout(timeoutHandle)
			timeoutHandle = null
		}
		removeToastFromList(toast)
	}

	const toast: Toast = {show, remove}

	return toast
}

export function showToast(params: ToastParams): void {
	makeToast(params).show()
}