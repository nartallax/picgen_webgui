import {MRBox, WBox, constBoxWrap, unbox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"

interface SelectProps {
	value: WBox<string>
	options: MRBox<readonly {readonly label: string, readonly value: string}[]>
}

export function Select(props: SelectProps): HTMLElement {

	const select: HTMLSelectElement = tag({
		tag: "select",
		onChange: () => props.value(select.value)
	}, constBoxWrap(props.options).mapArray(opt => opt.value, opt => tag({
		tag: "option",
		attrs: {
			value: unbox(opt).value
		}
	}, [unbox(opt).label])))

	return select
}