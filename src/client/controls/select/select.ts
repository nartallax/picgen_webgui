import {MRBox, WBox, constBoxWrap, unbox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./select.module.scss"

interface SelectProps {
	value: WBox<string | number>
	options: MRBox<readonly {readonly label: string, readonly value: string | number}[]>
	isParam?: MRBox<boolean>
}

export function Select(props: SelectProps): HTMLElement {

	const select: HTMLSelectElement = tag({
		class: [css.select, {
			[css.param!]: props.isParam
		}],
		tag: "select",
		onChange: () => {
			props.value(JSON.parse(select.value))
		}
	}, constBoxWrap(props.options).mapArray(opt => opt.value, opt => tag({
		tag: "option",
		attrs: {
			value: JSON.stringify(unbox(opt).value),
			// select won't take value until there's an <option> that matches the value
			// so you either wait for DOM tree to be built, or set "selected" on that <option>
			selected: unbox(opt).value === props.value()
		}
	}, [unbox(opt).label])))

	whileMounted(select, props.value, v => select.value = JSON.stringify(v))

	return select
}