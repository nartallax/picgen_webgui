import {RBox, box} from "@nartallax/cardboard"

type WH = {width: number, height: number}

function getWindowSize(): WH {
	return {
		width: window.innerWidth,
		height: window.innerHeight
	}
}

export function windowSizeBox(): RBox<WH> {
	const b = box<WH>(getWindowSize())

	window.addEventListener("resize", () => {
		b(getWindowSize())
	}, {passive: true})

	return b
}