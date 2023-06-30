import {hideSomeScrollbars, preventGalleryImageInteractions, paramsColumnWidth, uiScale, paramsColumnMaxWidth, paramsColumnMinWidth} from "client/app/global_values"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {FormField} from "client/controls/form/form"
import {showModal} from "client/controls/modal_base/modal"
import {Modal} from "client/controls/modal_base/modal_base"
import {NumberInput} from "client/controls/number_input/number_input"

export const showUserSettingsModal = (): Modal => {
	const modal = showModal({
		title: "User settings",
		width: "45rem"
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
			onRevert: () => uiScale(1),
			hint: "Allows to magnify or shrink interface without breaking anything.\n\nWorks by changing font unit size."
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
			onRevert: () => preventGalleryImageInteractions(false),
			hint: "Try enabling this setting if having trouble with drag in the gallery.\n\nThis can have also negative effects, so if drag works fine for you - don't change this setting."
		}),
		FormField({
			input: NumberInput({
				value: paramsColumnWidth.map(str => parseFloat(str) / 100, flt => (flt * 100) + "vw"),
				min: 0.05,
				max: 0.95,
				precision: 2
			}),
			label: "Params column width",
			revertable: paramsColumnWidth.map(str => str !== "20vw"),
			onRevert: () => paramsColumnWidth("20vw"),
			hint: "Width of parameters column, in page widths (1 = full page width).\n\nConstrained by max and min widths. Note that max/min widths are changed based on UI scale, but width of the column is calculated based on page width."
		}),
		FormField({
			input: NumberInput({value: paramsColumnMaxWidth.map(str => parseInt(str), num => num + "rem"), int: true}),
			label: "Params column max width",
			revertable: paramsColumnMaxWidth.map(str => str !== "35rem"),
			onRevert: () => paramsColumnMaxWidth("35rem"),
			hint: "Upper bound of width of parameters column, in font units."
		}),
		FormField({
			input: NumberInput({value: paramsColumnMinWidth.map(str => parseInt(str), num => num + "rem"), int: true}),
			label: "Params column max width",
			revertable: paramsColumnMinWidth.map(str => str !== "20rem"),
			onRevert: () => paramsColumnMinWidth("20rem"),
			hint: "Lower bound of width of parameters column, in font units."
		})
	])

	return modal
}