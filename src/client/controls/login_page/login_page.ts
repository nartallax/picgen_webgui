import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {Button} from "client/controls/button/button"
import {SettingsBlock} from "client/controls/settings_block/settings_block"
import {SettingsSubblockHeader} from "client/controls/settings_subblock_header/settings_subblock_header"
import * as css from "./login_page.module.scss"

export function LoginPage(): HTMLElement {
	return tag({class: css.loginPage}, [
		SettingsBlock([
			SettingsSubblockHeader({header: "Login"}),
			Button({
				onclick: async() => {
					const proto = window.location.protocol.toLowerCase().startsWith("https") ? "https" as const : "http" as const
					const url = await ClientApi.getDiscordLoginUrl(proto, window.location.host)
					window.location.href = url
				},
				text: "Login with discord"
			})
		])
	])
}