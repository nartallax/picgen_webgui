import {WBox} from "@nartallax/cardboard"
import {bindBox, tag} from "@nartallax/cardboard-dom"
import * as css from "./prompt_input.module.scss"

interface PromptInputProps {
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
		onInput: () => props.promptValue.set(input.value)
	})

	input.addEventListener("keydown", e => {
		if(e.key === "Enter" && !e.shiftKey){
			e.preventDefault()
			props.startGeneration()
		}
	})

	const result = tag({class: css.promptInput}, [
		tag({class: css.firstLine}, [
			tag({class: css.inputWrap}, [input]),
			tag({
				tag: "button",
				class: [css.generateButton, "icon-brush"],
				onClick: props.startGeneration // TODO: falloff to prevent doubleclicking
			})
		])
	])

	bindBox(result, props.promptValue, v => input.value = v)

	return result
}