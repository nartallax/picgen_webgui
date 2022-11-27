import {MaybeRBoxed} from "client/base/box"
import {tag} from "client/base/tag"

interface TooltipIconOptions {
	tooltip: MaybeRBoxed<string>
}

export function TooltipIcon(opts: TooltipIconOptions) {

	return tag({
		class: "tooltip-icon",
		text: "?"
	}, [
		tag({class: "tooltip-content-wrap"}, [
			tag({
				class: "tooltip-content",
				text: opts.tooltip
			})
		])
	])

}