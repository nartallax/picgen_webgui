import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./layout.module.scss"
import {DefaultableSpacing, LayoutCommonProps, makeCommonLayoutStyle, resolveSpacing} from "client/controls/layout/layout"
import {RBox} from "@nartallax/cardboard"

type Props = {
	justify?: "start" | "center" | "space-between" | "end"
	align?: "start" | "center" | "end"
	gap?: DefaultableSpacing
	grow?: number
} & LayoutCommonProps

const defaults = {
	justify: "center",
	align: "center"
} satisfies Partial<Props>

function resolveFlexAlign(align: RBox<string>): RBox<string> {
	return align.map(x => x === "start" || x === "end" ? "flex-" + x : x)
}

export const Row = defineControl<Props, typeof defaults>(defaults, (props, children) => {
	return tag({class: css.row, style: {
		justifyContent: resolveFlexAlign(props.justify),
		alignItems: resolveFlexAlign(props.align),
		gap: resolveSpacing(props.gap),
		...makeCommonLayoutStyle(props)
	}}, children)
})

export const Col = defineControl<Props, typeof defaults>(defaults, (props, children) => {
	return tag({class: css.col, style: {
		justifyContent: resolveFlexAlign(props.justify),
		alignItems: resolveFlexAlign(props.align),
		gap: resolveSpacing(props.gap),
		...makeCommonLayoutStyle(props)
	}}, children)
})