import {RBox, box} from "@nartallax/cardboard"

// TODO: this looks excessive and cringe. feels like it should be bound to some element
let nowBox: RBox<number> | null = null
export function getNowBox(): RBox<number> {
	if(!nowBox){
		const wbox = nowBox = box(Date.now())
		setInterval(() => {
			wbox.set(Date.now())
		}, 1000)
	}
	return nowBox
}