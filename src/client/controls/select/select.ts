import {MaybeRBoxed, unbox, WBox} from "client/base/box"
import {renderArray, tag} from "client/base/tag"

interface SelectOptions {
	value: WBox<string>
	options: MaybeRBoxed<readonly {readonly label: string, readonly value: string}[]>
}

export function Select(opts: SelectOptions): HTMLElement {

	const select = tag({
		tagName: "select",
		on: {change: () => {
			opts.value(select.value)
		}}
	}, renderArray(opts.options, opt => opt.value, opt => tag({
		tagName: "option",
		attrs: {
			value: unbox(opt).value
		},
		text: unbox(opt).label
	})))

	return select
}