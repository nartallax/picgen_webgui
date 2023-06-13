import {tag} from "@nartallax/cardboard-dom"
import * as css from "./form.module.scss"
import {MRBox, constBoxWrap, isConstBox, isRBox, unbox} from "@nartallax/cardboard"
import {TooltipIcon} from "client/controls/tooltip/tooltip"

type FormFieldProps = {
	label: MRBox<string>
	input: HTMLElement
	hint?: MRBox<string | undefined>
	onRevert?: () => void
	revertable?: MRBox<boolean>
	visible?: MRBox<boolean>
	onDelete?: () => void
	maxLabelWidth?: MRBox<string>
}

export const FormField = (props: FormFieldProps): HTMLElement => {
	const display = constBoxWrap(props.visible).map(visible => visible === false ? "none" : "")

	return tag({class: css.formField, style: {display}}, [
		tag({class: css.label}, [
			tag({
				class: css.labelText,
				style: {
					maxWidth: props.maxLabelWidth
				}
			}, [props.label]),
			!props.hint ? null : TooltipIcon({tooltip: props.hint})
		]),
		tag({
			style: {
				display: (isConstBox(props.revertable) || !isRBox(props.revertable)) && !unbox(props.revertable) ? "none" : ""
			},
			class: [css.revertButton, "icon-ccw", {
				[css.hidden!]: constBoxWrap(props.revertable).map(revertable => !revertable)
			}],
			onClick: props.onRevert
		}),
		tag({
			class: [css.inputWrap, {
				[css.withDeleteButton!]: constBoxWrap(props.onDelete).map(onDelete => !!onDelete)
			}]
		}, [
			props.input,
			tag({
				class: [css.deleteButton, "icon-cancel"],
				onClick: () => props.onDelete?.()
			})
		])
	])
}