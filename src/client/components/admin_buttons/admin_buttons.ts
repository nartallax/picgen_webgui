import {viewBox} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import {currentUser, isUserControlEnabled} from "client/app/global_values"
import {showUsersModal} from "client/components/admin_buttons/users_modal"
import {Button} from "client/controls/button/button"
import {BlockPanel} from "client/components/block_panel/block_panel"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"

export const AdminButtons = defineControl(() => {
	return tag({
		style: {
			display: viewBox(() => !isUserControlEnabled() || currentUser()?.isAdmin ? "" : "none")
		}
	}, [BlockPanel([
		BlockPanelHeader({header: "Admin actions"}),
		Button({
			text: "Users",
			onclick: showUsersModal
		})
	])])
})