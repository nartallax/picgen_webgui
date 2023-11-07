import {WBox} from "@nartallax/cardboard"
import {bindBox, onMount, tag} from "@nartallax/cardboard-dom"
import * as css from "./prompt_input.module.scss"
import {Icon} from "client/generated/icons"
import {LockButton} from "client/controls/lock_button/lock_button"
import {tabOverride} from "client/app/global_values"

interface PromptInputProps {
	isLocked: WBox<boolean>
	promptValue: WBox<string>
	startGeneration(): void
}

export function PromptInput(props: PromptInputProps): HTMLElement {

	const input: HTMLTextAreaElement = tag({
		tag: "textarea",
		class: css.inputInput,
		attrs: {
			placeholder: "...Enter a description of the desired result",
			rows: 100
		},
		onInput: () => props.promptValue.set(input.value),
		onKeydown: e => {
			if(e.key === "Escape"){
				input.blur()
			}
		}
	})

	let lastClickTime = 0
	const onStartGeneration = () => {
		const now = Date.now()
		if(now - lastClickTime < 500){
			return
		}
		lastClickTime = now
		props.startGeneration()
	}

	const result = tag({class: css.promptInput}, [
		tag({class: css.lockButton}, [
			LockButton({isLocked: props.isLocked})
		]),
		tag({class: css.firstLine}, [
			tag({class: css.inputWrap}, [input]),
			tag({
				tag: "button",
				class: [css.generateButton, Icon.brush],
				onClick: onStartGeneration
			})
		])
	])

	bindBox(result, props.promptValue, v => input.value = v)

	onMount(result, () => {
		const handler = (e: KeyboardEvent) => {
			if(e.key !== "Tab" || !tabOverride.get()){
				return
			}

			e.preventDefault()
			e.stopPropagation()
			input.focus()
			input.selectionStart = 0
			input.selectionEnd = input.value.length
		}

		window.addEventListener("keydown", handler, {capture: true})
		return () => window.removeEventListener("keydown", handler)
	})

	return result
}