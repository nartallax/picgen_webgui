import {uiScale} from "client/app/global_values"
import {Form, FormField} from "client/controls/form/form"
import {showModal} from "client/controls/modal_base/modal"
import {Modal} from "client/controls/modal_base/modal_base"
import {NumberInput} from "client/controls/number_input/number_input"

export const showUserSettingsModal = (): Modal => {
	const modal = showModal({
		title: "User settings",
		width: "25rem"
	}, [
		Form([
			FormField({
				input: NumberInput({
					value: uiScale,
					max: 100,
					min: 0.25,
					precision: 2
				}),
				label: "UI scale",
				revertable: true,
				onRevert: () => uiScale(1)
			})
		])
	])

	return modal
}