import {tag} from "@nartallax/cardboard-dom"
import * as css from "./loading_page.module.scss"

export function LoadingPage(): HTMLElement {
	return tag({class: css.loadingPage}, [
		tag({class: css.text}, ["Loading..."])
	])
}