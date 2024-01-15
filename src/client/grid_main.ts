import {WBox, box} from "@nartallax/cardboard"
import {initializeCardboardDom} from "@nartallax/cardboard-dom"
import {Grid, GridProps} from "client/controls/grid_for_real_this_time/grid"
import * as css from "./grid_main_style.module.scss"

interface ExampleDataRow {
	id: number
	name: string
	age: number
}

const digits = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]

function nameDigits(x: number): string {
	let result = ""
	do {
		result = digits[x % 10] + (result ? "-" + result : "")
		x = Math.floor(x / 10)
	} while(x !== 0)
	return result
}

function generateExampleData(): ExampleDataRow[] {
	const dataArr: ExampleDataRow[] = []
	for(let i = 0; i < 1000; i++){
		dataArr.push({
			id: i,
			name: nameDigits(i),
			age: Math.round((Math.random() * 60) + 20)
		})
	}
	return dataArr
}

const main = async() => {
	await initializeCardboardDom()

	const props: GridProps<ExampleDataRow> = {
		data: box(generateExampleData()),
		renderRow: (el: WBox<ExampleDataRow>) => el.map(el => el.id + " " + el.name + " of age " + el.age),
		getKey: row => row.id,
		css: {
			root: css.exampleGrid,
			row: css.exampleGridRow
		}
	}

	const grid = Grid(props)

	document.body.appendChild(grid)
}

void main()
