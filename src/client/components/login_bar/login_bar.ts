import {viewBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {currentPage, currentUser} from "client/app/global_values"
import {Button} from "client/controls/button/button"
import * as css from "./login_bar.module.scss"

export function LoginBar(): HTMLElement {

	const nicknameEl = tag({
		class: css.nickname
	}, [viewBox(() => currentUser()?.displayName || "<unnamed user>")])

	return tag({class: css.loginBar}, [
		tag({
			tag: "img",
			class: css.avatar,
			attrs: {
				src: viewBox(() => currentUser()?.avatarUrl || ""),
				alt: "Avatar"
			}
		}),
		nicknameEl,
		Button({
			iconClass: "icon-logout",
			onclick: async() => {
				await ClientApi.logout()
				currentUser(null)
				currentPage("login")
			}
		})
	])

}