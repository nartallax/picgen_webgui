import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./layout.module.scss"
import {DefaultableSpacing, LayoutCommonProps, makeCommonLayoutStyle, resolveSpacing} from "client/controls/layout/layout"
import {MRBox, RBox, constBoxWrap} from "@nartallax/cardboard"

type Props = {
	justify?: MRBox<"start" | "center" | "space-between" | "end">
	align?: MRBox<"start" | "center" | "end" | "stretch">
	gap?: MRBox<DefaultableSpacing>
	grow?: MRBox<number>
	class?: MRBox<string>
} & LayoutCommonProps

function resolveFlexAlign(align: MRBox<string>): RBox<string> {
	return constBoxWrap(align).map(x => x === "start" || x === "end" ? "flex-" + x : x)
}

export const Row = defineControl((props: Props, children) => {
	return tag({class: [css.row, props.class], style: {
		justifyContent: resolveFlexAlign(props.justify ?? "center"),
		alignItems: resolveFlexAlign(props.align ?? "center"),
		gap: resolveSpacing(props.gap),
		...makeCommonLayoutStyle(props)
	}}, children)
})

export const Col = defineControl((props: Props, children) => {
	return tag({class: [css.col, props.class], style: {
		justifyContent: resolveFlexAlign(props.justify ?? "center"),
		alignItems: resolveFlexAlign(props.align ?? "center"),
		gap: resolveSpacing(props.gap),
		...makeCommonLayoutStyle(props)
	}}, children)
})