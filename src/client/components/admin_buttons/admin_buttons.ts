import {calcBox} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import {currentUser, isUserControlEnabled} from "client/app/global_values"
import {showUsersModal} from "client/components/admin_buttons/users_modal"
import {Button} from "client/controls/button/button"
import {BlockPanel} from "client/components/block_panel/block_panel"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {Col} from "client/controls/layout/row_col"
import {showTasksModal} from "client/components/admin_buttons/tasks_modal"

export const AdminButtons = defineControl(() => {
	return tag({
		style: {
			display: calcBox([isUserControlEnabled, currentUser], (enabled, user) => !enabled || user?.isAdmin ? "" : "none")
		}
	}, [BlockPanel([
		BlockPanelHeader({header: "Admin actions"}),
		Col({align: "stretch", gap: true}, [
			Button({
				text: "Users",
				onclick: showUsersModal
			}),
			Button({
				text: "Tasks",
				onclick: showTasksModal
			})
		])
	])])
})