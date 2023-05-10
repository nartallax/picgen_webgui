import {box} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import * as css from "./button.module.scss"

interface ButtonProps {
	onclick(): void | Promise<void>
	text?: string | null
	iconClass?: string | null
}

const defaults = {
	text: null,
	iconClass: null
} satisfies Partial<ButtonProps>

export const Button = defineControl<ButtonProps, typeof defaults>(defaults, props => {

	const clickIsActive = box(false)

	async function wrappedOnclick() {
		clickIsActive(true)
		try {
			await Promise.resolve(props.onclick())
		} finally {
			clickIsActive(false)
		}
	}

	return tag({
		tag: "button",
		class: [css.button, props.iconClass, {
			[css.disabled!]: clickIsActive,
			[css.moreHPadding!]: props.text.map(text => !!text)
		}],
		onClick: wrappedOnclick
	}, [props.text])
})