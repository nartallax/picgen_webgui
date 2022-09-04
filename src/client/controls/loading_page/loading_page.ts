import {tag} from "client/base/tag"

export function LoadingPage(): HTMLElement {
	return tag({class: "loading-page"}, [
		tag({class: "loading-page-text", text: "Loading..."})
	])
}