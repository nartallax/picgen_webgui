import {ClientApi} from "client/app/client_api"
import {tag} from "client/base/tag"
import {Button} from "client/controls/button/button"
import {SettingsBlock} from "client/controls/settings_block/settings_block"
import {SettingsSubblock} from "client/controls/settings_subblock/settings_subblock"

export function LoginPage(): HTMLElement {
	return tag({class: "login-page"}, [
		SettingsBlock([
			SettingsSubblock({header: "Login"}, [
				Button({
					onclick: async() => {
						const url = await ClientApi.getDiscordLoginUrl()
						window.location.href = url
					},
					text: "Login with discord"
				})
			])
		])
	])
}