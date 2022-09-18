import {box, RBox} from "client/base/box"

let nowBox: RBox<number> | null = null
export function getNowBox(): RBox<number> {
	if(!nowBox){
		const wbox = nowBox = box(Date.now())
		setInterval(() => {
			wbox(Date.now())
		}, 1000)
	}
	return nowBox
}