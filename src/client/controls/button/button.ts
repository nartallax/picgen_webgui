import {box, viewBox} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./button.module.scss"

interface ButtonProps {
	onclick(): void | Promise<void>
	text?: string | null
	iconClass?: string | null
	variant?: "normal" | "small"
	isDisabled?: boolean
}

const defaults = {
	text: null,
	iconClass: null,
	variant: "normal",
	isDisabled: false
} satisfies Partial<ButtonProps>

export const Button = defineControl<ButtonProps, typeof defaults>(defaults, props => {

	const clickIsActive = box(false)

	async function wrappedOnclick() {
		clickIsActive(true)
		try {
			await Promise.resolve(props.onclick()())
		} finally {
			clickIsActive(false)
		}
	}

	return tag({
		tag: "button",
		class: [css.button, props.iconClass, css[props.variant()], {
			[css.disabled!]: viewBox(() => clickIsActive() || props.isDisabled()),
			[css.moreHPadding!]: props.text.map(text => !!text)
		}],
		onClick: wrappedOnclick
	}, [props.text])
})