import {hideSomeScrollbars, preventGalleryImageInteractions, uiScale} from "client/app/global_values"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {FormField} from "client/controls/form/form"
import {showModal} from "client/controls/modal_base/modal"
import {Modal} from "client/controls/modal_base/modal_base"
import {NumberInput} from "client/controls/number_input/number_input"

export const showUserSettingsModal = (): Modal => {
	const modal = showModal({
		title: "User settings",
		width: "35rem"
	}, [
		FormField({
			input: NumberInput({
				value: uiScale,
				max: 100,
				min: 0.25,
				precision: 2
			}),
			label: "UI scale",
			revertable: uiScale.map(scale => scale !== 1),
			onRevert: () => uiScale(1)
		}),
		FormField({
			input: BoolInput({value: hideSomeScrollbars}),
			label: "Hide some scrollbars",
			revertable: hideSomeScrollbars,
			onRevert: () => hideSomeScrollbars(false)
		}),
		FormField({
			input: BoolInput({value: preventGalleryImageInteractions}),
			label: "Block gallery image click",
			revertable: preventGalleryImageInteractions,
			onRevert: () => preventGalleryImageInteractions(false)
		})
	])

	return modal
}