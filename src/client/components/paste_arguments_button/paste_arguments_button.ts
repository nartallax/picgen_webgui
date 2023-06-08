import {loadArguments} from "client/app/load_arguments"
import {showTaskArgsModal} from "client/components/task_args_modal/task_args_modal"
import {IconButton} from "client/controls/icon_button/icon_button"
import * as css from "./paste_arguments_button.module.scss"

export const PasteArgumentsButton = () => {
	return IconButton({
		icon: "icon-code",
		class: css.pasteArgumentsButton,
		onClick: async() => {
			const args = await showTaskArgsModal()
			if(!args){
				return
			}

			loadArguments(args)
		}
	})
}