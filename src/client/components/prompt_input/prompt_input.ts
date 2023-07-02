import {RBox, WBox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {SelectSearch} from "client/controls/select_search/select_search"
import * as css from "./prompt_input.module.scss"

interface PromptInputProps {
	shapeValues: RBox<null | readonly string[]>
	shapeValue: WBox<string | null>
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
		onInput: () => props.promptValue(input.value)
	})

	input.addEventListener("keydown", e => {
		if(e.key === "Enter" && !e.shiftKey){
			e.preventDefault()
			props.startGeneration()
		}
	})

	const result = tag({class: css.promptInput}, [
		tag({class: css.firstLine}, [
			tag({class: css.selectSearchWrap}, [
				SelectSearch({
					availableValues: props.shapeValues,
					value: props.shapeValue,
					listSizeLimit: 10
				})
			]),
			tag({class: css.inputWrap}, [input]),
			tag({
				tag: "button",
				class: [css.generateButton, "icon-brush"],
				onClick: props.startGeneration // TODO: falloff to prevent doubleclicking
			})
		])
	])

	whileMounted(result, props.promptValue, v => input.value = v)

	return result
}