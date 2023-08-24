import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {currentPage, currentUser} from "client/app/global_values"
import {Button} from "client/controls/button/button"
import * as css from "./login_bar.module.scss"
import {showUserSettingsModal} from "client/components/user_settings_modal/user_settings_modal"

export function LoginBar(): HTMLElement {

	const nicknameEl = tag({
		class: css.nickname
	}, [currentUser.map(user => user?.displayName || "<unnamed user>")])

	return tag({class: css.loginBar}, [
		tag({
			tag: "img",
			class: css.avatar,
			attrs: {
				src: currentUser.map(user => user?.avatarUrl || ""),
				alt: "Avatar"
			}
		}),
		nicknameEl,
		Button({
			iconClass: "icon-cog",
			class: css.settingsIcon,
			onClick: () => {
				showUserSettingsModal()
			}
		}),
		Button({
			iconClass: "icon-logout",
			onClick: async() => {
				await ClientApi.logout()
				currentUser.set(null)
				currentPage.set("login")
			}
		})
	])

}