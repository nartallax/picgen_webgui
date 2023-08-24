import {MRBox, RBox, isRBox} from "@nartallax/cardboard"
import {StyleValues} from "@nartallax/cardboard-dom"

export type DefaultableSpacing = "vertical" | "horisontal" | "top" | "bottom" | "left" | "right" | boolean | string

const defaultSpacing = "0.5rem"

export function resolveSpacing(padding: DefaultableSpacing | undefined): string | undefined
export function resolveSpacing(padding: RBox<DefaultableSpacing | undefined> | undefined): RBox<string | undefined>
export function resolveSpacing(padding: MRBox<DefaultableSpacing | undefined> | undefined): MRBox<string | undefined>
export function resolveSpacing(spacing: MRBox<DefaultableSpacing | undefined>): MRBox<string | undefined> {
	if(!spacing){
		return undefined
	}
	if(isRBox(spacing)){
		return spacing.map(padding => resolveSpacing(padding))
	}
	switch(spacing){
		case true: return defaultSpacing
		case "vertical": return defaultSpacing + " 0"
		case "horisontal": return "0 " + defaultSpacing
		case "top": return defaultSpacing + " 0 0 0"
		case "bottom": return "0 0 " + defaultSpacing + " 0"
		case "left": return "0 0 0 " + defaultSpacing
		case "right": return "0 " + defaultSpacing + " 0 0"
	}
	if(typeof(spacing) === "string"){
		return spacing
	}
	return undefined // I guess...?
}


export type LayoutCommonProps = {
	padding?: MRBox<DefaultableSpacing>
	grow?: MRBox<number>
	shrink?: MRBox<number>
}

export function makeCommonLayoutStyle(props: LayoutCommonProps): StyleValues {
	const result: StyleValues = {
		padding: resolveSpacing(props.padding),
		flexGrow: props.grow,
		flexShrink: props.shrink
	}
	return result
}