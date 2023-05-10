import {tag} from "@nartallax/cardboard-dom"

export function LoadingPage(): HTMLElement {
	return tag({class: "loading-page"}, [
		tag({class: "loading-page-text"}, ["Loading..."])
	])
}