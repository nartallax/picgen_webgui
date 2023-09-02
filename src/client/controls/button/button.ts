import {MRBox, box, calcBox, constBoxWrap} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./button.module.scss"
import {Icon} from "client/generated/icons"

interface ButtonProps {
	onClick(): void | Promise<void>
	text?: MRBox<string | null>
	icon?: MRBox<Icon | null>
	class?: MRBox<string | null>
	variant?: MRBox<"normal" | "small" | "big">
	moreHPadding?: boolean
	isDisabled?: MRBox<boolean>
}

export const Button = defineControl((props: ButtonProps) => {

	const clickIsActive = box(false)

	async function wrappedOnclick() {
		clickIsActive.set(true)
		try {
			await Promise.resolve(props.onClick())
		} finally {
			clickIsActive.set(false)
		}
	}

	return tag({
		tag: "button",
		class: [css.button, props.icon, props.class, css[constBoxWrap(props.variant ?? "normal").get()], {
			[css.disabled!]: calcBox(
				[clickIsActive, props.isDisabled ?? false],
				(isClicking, isDisabled) => isClicking || isDisabled
			),
			[css.moreHPadding!]: calcBox([props.moreHPadding, props.text], (morePadding, text) => morePadding ?? !!text)
		}],
		onClick: wrappedOnclick
	}, [props.text])
})