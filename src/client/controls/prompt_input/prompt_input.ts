import {RBox, WBox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {SelectSearch} from "client/controls/select_search/select_search"
import {TagList} from "client/controls/tag_list/tag_list"

interface PromptInputProps {
	shapeValues: RBox<null | readonly string[]>
	shapeValue: WBox<string>
	selectedContentTags: WBox<string[]>
	promptValue: WBox<string>
	startGeneration(): void
}

export function PromptInput(props: PromptInputProps): HTMLElement {
	const input: HTMLInputElement = tag({
		tag: "input",
		class: "prompt-input-input",
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

	const result = tag({class: "prompt-input"}, [
		tag({class: "prompt-input-first-line"}, [
			SelectSearch({
				availableValues: props.shapeValues,
				value: props.shapeValue,
				listSizeLimit: 10
			}),
			input,
			tag({
				class: ["prompt-input-generate-button", "icon-brush"],
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