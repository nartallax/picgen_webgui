import {tag} from "@nartallax/cardboard-dom"
import {defineControl} from "@nartallax/cardboard-dom"
import * as css from "./form.module.scss"
import {MRBox, WBox, constBoxWrap, isConstBox, isRBox, unbox} from "@nartallax/cardboard"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {TooltipIcon} from "client/controls/tooltip/tooltip"

export const Form = defineControl((_, children) => {
	return tag({tag: "table", class: css.form}, children)
})


type FormHeaderProps = {
	header: MRBox<string>
	toggle?: WBox<boolean>
}

export const FormHeader = (props: FormHeaderProps): HTMLElement => tag({tag: "tr"}, [
	tag({
		tag: "td",
		attrs: {colspan: 3}
	}, [BlockPanelHeader(props)])
])

type FormFieldProps = {
	label: MRBox<string>
	input: HTMLElement
	hint?: MRBox<string | undefined>
	onRevert?: () => void
	revertable?: MRBox<boolean>
	visible?: MRBox<boolean>
	onDelete?: () => void
}

export const FormField = (props: FormFieldProps): HTMLElement => {
	const display = constBoxWrap(props.visible).map(visible => visible === false ? "none" : "")

	return tag({tag: "tr", class: css.formField, style: {display}}, [
		tag({
			tag: "td",
			class: css.label
		}, [
			tag({class: css.labelText}, [props.label]),
			!props.hint ? null : TooltipIcon({tooltip: props.hint})
		]),
		tag({
			tag: "td",
			style: {
				display: (isConstBox(props.revertable) || !isRBox(props.revertable)) && !unbox(props.revertable) ? "none" : ""
			},
			class: [css.revertButton, "icon-ccw", {
				[css.hidden!]: constBoxWrap(props.revertable).map(revertable => !revertable)
			}],
			onClick: props.onRevert
		}),
		tag({
			tag: "td",
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