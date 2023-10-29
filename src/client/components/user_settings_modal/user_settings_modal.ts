import {hideSomeScrollbars, preventGalleryImageInteractions, paramsColumnWidth, uiScale, paramsColumnMaxWidth, paramsColumnMinWidth, formLabelWidth, visualTheme, toastCountLimit, toastDurationOverride, shiftWheelForZoom} from "client/app/global_values"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {Button} from "client/controls/button/button"
import {FormField} from "client/controls/form/form"
import {Row} from "client/controls/layout/row_col"
import {showModal} from "client/controls/modal_base/modal"
import {Modal} from "client/controls/modal_base/modal_base"
import {NumberInput} from "client/controls/number_input/number_input"
import {showToast} from "client/controls/toast/toast"

export const showUserSettingsModal = (): Modal => {
	let exampleToastCount = 0

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
			onRevert: () => uiScale.set(1),
			hint: "Allows to magnify or shrink interface without breaking anything.\n\nWorks by changing font unit size."
		}),
		FormField({
			input: BoolInput({value: hideSomeScrollbars}),
			label: "Hide some scrollbars",
			revertable: hideSomeScrollbars,
			onRevert: () => hideSomeScrollbars.set(false),
			hint: "Hide scrollbars in the parameter column and in the task list. The content still will be scrollable through other means.\n\nScrollbars are shown by default for accessibility reasons."
		}),
		FormField({
			input: BoolInput({value: preventGalleryImageInteractions}),
			label: "Block gallery image click",
			revertable: preventGalleryImageInteractions,
			onRevert: () => preventGalleryImageInteractions.set(false),
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
			onRevert: () => paramsColumnWidth.set("20vw"),
			hint: "Width of parameters column, in page widths (1 = full page width).\n\nConstrained by max and min widths. Note that max/min widths are changed based on UI scale, but width of the column is calculated based on page width."
		}),
		FormField({
			input: NumberInput({value: paramsColumnMaxWidth.map(str => parseInt(str), num => num + "rem"), int: true}),
			label: "Params column max width",
			revertable: paramsColumnMaxWidth.map(str => str !== "35rem"),
			onRevert: () => paramsColumnMaxWidth.set("35rem"),
			hint: "Upper bound of width of parameters column, in font units."
		}),
		FormField({
			input: NumberInput({value: paramsColumnMinWidth.map(str => parseInt(str), num => num + "rem"), int: true}),
			label: "Params column min width",
			revertable: paramsColumnMinWidth.map(str => str !== "20rem"),
			onRevert: () => paramsColumnMinWidth.set("20rem"),
			hint: "Lower bound of width of parameters column, in font units."
		}),
		FormField({
			input: NumberInput({
				value: formLabelWidth.map(str => parseFloat(str) / 100, flt => (flt * 100) + "%"),
				min: 0.05,
				max: 0.95,
				precision: 2
			}),
			label: "Form label width",
			revertable: formLabelWidth.map(str => str !== "50%"),
			onRevert: () => formLabelWidth.set("50%"),
			hint: "Width of labels in various forms, most notably parameter form, in rate related to form width."
		}),
		FormField({
			input: BoolInput({value: visualTheme.map(theme => theme === "dark", isDark => isDark ? "dark" : "default")}),
			label: "Dark theme",
			revertable: visualTheme.map(theme => theme !== "default"),
			onRevert: () => visualTheme.set("default")
		}),
		FormField({
			input: BoolInput({value: shiftWheelForZoom}),
			label: "Shift+wheel for zoom",
			hint: "If enabled, wheel scrolling in image viewer will lead to horisontal pan, and shift+wheel to zoom.\nIf disabled - this behaviour is inverted.",
			revertable: shiftWheelForZoom.map(enabled => !enabled),
			onRevert: () => shiftWheelForZoom.set(true)
		}),
		FormField({
			input: NumberInput({value: toastCountLimit}),
			label: "Toast count limit",
			revertable: toastCountLimit.map(limit => limit !== -1),
			onRevert: () => toastCountLimit.set(-1),
			hint: "Limit on number of toasts that can be shown simultaneously. If toast wants to be shown, and there is already max number of toasts on screen, oldest one will be removed.\n\nLess than zero = no limit"
		}),
		FormField({
			input: NumberInput({value: toastDurationOverride}),
			label: "Toast duration",
			revertable: toastDurationOverride.map(limit => limit !== -1),
			onRevert: () => toastDurationOverride.set(-1),
			hint: "Override of duration for which each toast is shown, in seconds.\n\nLess than zero = duration of toasts is determined by code that created the toast."
		}),
		Row({padding: true}, [
			Button({
				text: "Show example toast",
				onClick: () => showToast({text: "Example #" + (++exampleToastCount), timeoutSeconds: 5, type: "info"})
			})
		])
	])

	return modal
}