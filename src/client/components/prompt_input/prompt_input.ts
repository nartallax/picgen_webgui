import {RBox, WBox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {SelectSearch} from "client/controls/select_search/select_search"
import {TagList} from "client/controls/tag_list/tag_list"
import * as css from "./prompt_input.module.scss"

interface PromptInputProps {
	shapeValues: RBox<null | readonly string[]>
	shapeValue: WBox<string | null>
	selectedContentTags: WBox<readonly string[]>
	promptValue: WBox<string>
	startGeneration(): void
}

export function PromptInput(props: PromptInputProps): HTMLElement {
	const input: HTMLInputElement = tag({
		tag: "input",
		class: css.inputInput,
		attrs: {
			placeholder: "...Enter a description of the desired result"
		},
		onInput: () => props.promptValue(input.value),
		onKeydown: e => {
			if(e.key === "Enter"){
				props.startGeneration()
			}
		}
	})

	const result = tag({class: css.promptInput}, [
		tag({class: css.firstLine}, [
			SelectSearch({
				availableValues: props.shapeValues,
				value: props.shapeValue,
				listSizeLimit: 10
			}),
			input,
			tag({
				class: [css.generateButton, "icon-brush"],
				onClick: props.startGeneration // TODO: falloff to prevent doubleclicking
			})
		]),
		TagList({
			values: props.selectedContentTags,
			center: true
		})
	])

	whileMounted(result, props.promptValue, v => input.value = v)

	return result
}