import {viewBox} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import {currentUser, isUserControlEnabled} from "client/app/global_values"
import {showUsersModal} from "client/controls/admin_buttons/users_modal"
import {Button} from "client/controls/button/button"
import {SettingsBlock} from "client/controls/settings_block/settings_block"
import {SettingsSubblockHeader} from "client/controls/settings_subblock_header/settings_subblock_header"

export const AdminButtons = defineControl(() => {
	return tag({
		style: {
			display: viewBox(() => !isUserControlEnabled() || currentUser()?.isAdmin ? "" : "none")
		}
	}, [SettingsBlock([
		SettingsSubblockHeader({header: "Admin actions"}),
		Button({
			text: "Users",
			onclick: showUsersModal
		})
	])])
})