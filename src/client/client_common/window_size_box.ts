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

	// TODO: never unsubscribes. cringe!
	window.addEventListener("resize", () => {
		b.set(getWindowSize())
	}, {passive: true})

	return b
}