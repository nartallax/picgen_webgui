import {getBinder} from "client/base/binder/binder"
import {RBox, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {SelectSearch} from "client/controls/select_search/select_search"
import {TagList} from "client/controls/tag_list/tag_list"

interface PromptInputOptions {
	shapeValues: RBox<null | readonly string[]>
	shapeValue: WBox<string>
	selectedContentTags: WBox<string[]>
	promptValue: WBox<string>
	startGeneration(): void
}

export function PromptInput(opts: PromptInputOptions): HTMLElement {
	const input: HTMLInputElement = tag({
		tagName: "input",
		class: "prompt-input-input",
		attrs: {
			placeholder: "...Enter a description of the desired result"
		},
		on: {
			input: () => opts.promptValue(input.value),
			keydown: e => {
				if(e.key === "Enter"){
					opts.startGeneration()
				}
			}
		}
	})

	const result = tag({class: "prompt-input"}, [
		tag({class: "prompt-input-first-line"}, [
			SelectSearch({
				availableValues: opts.shapeValues,
				value: opts.shapeValue,
				listSizeLimit: 10
			}),
			input,
			tag({
				class: ["prompt-input-generate-button", "icon-brush"],
				on: {click: opts.startGeneration} // TODO: falloff to prevent doubleclicking
			})
		]),
		TagList({
			values: opts.selectedContentTags,
			center: true
		})
	])

	const binder = getBinder(result)
	binder.watchAndRun(opts.promptValue, v => input.value = v)

	return result
}