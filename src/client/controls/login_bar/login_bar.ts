import {ClientApi} from "client/app/client_api"
import {currentPage, currentUser} from "client/app/global_values"
import {viewBox} from "client/base/box"
import {tag} from "client/base/tag"
import {Button} from "client/controls/button/button"

export function LoginBar(): HTMLElement {

	const nicknameEl = tag({
		class: "login-bar-nickname",
		text: viewBox(() => currentUser()?.displayName || "<unnamed user>")
	})

	return tag({class: "login-bar"}, [
		tag({
			class: "login-bar-avatar",
			tagName: "img",
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