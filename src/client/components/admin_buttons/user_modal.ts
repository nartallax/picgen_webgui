import {WBox} from "@nartallax/cardboard"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {Button} from "client/controls/button/button"
import {FormField} from "client/controls/form/form"
import {Row} from "client/controls/layout/row_col"
import {showModal} from "client/controls/modal_base/modal"
import {Modal} from "client/controls/modal_base/modal_base"
import {TextInput} from "client/controls/text_input/text_input"
import {User} from "common/entities/user"

type Props = {
	value: WBox<User>
}

export function showUserModal(props: Props): Modal {
	const modal = showModal({
		title: props.value.map(user => user.id ? "User #" + user.id : "New user"),
		width: ["16rem", "50vw", "32rem"]
	}, [
		FormField({label: "Discord ID", input: TextInput({
			value: props.value.prop("discordId"),
			disabled: props.value.map(user => !!user.id)
		})}),
		FormField({label: "Name", input: TextInput({
			value: props.value.prop("displayName"),
			disabled: props.value.map(user => !!user.id)
		})}),
		FormField({label: "Is allowed", input: BoolInput({value: props.value.prop("isAllowed")})}),
		FormField({label: "Is admin", input: BoolInput({value: props.value.prop("isAdmin")})}),
		Row({gap: true, justify: "end", padding: "top"}, [
			Button({text: "Save", onClick: () => modal.close("confirm")}),
			Button({text: "Cancel", onClick: () => modal.close()})
		])
	])

	return modal
}