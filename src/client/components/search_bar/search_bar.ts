import {WBox} from "@nartallax/cardboard"
import * as css from "./search_bar.module.scss"
import {tag} from "@nartallax/cardboard-dom"
import {Icon} from "client/generated/icons"
import {IconButton} from "client/controls/icon_button/icon_button"

interface Props {
	readonly searchText: WBox<string>
	readonly isSearchActive: WBox<boolean>
}

export const SearchBar = (props: Props) => {
	const input: HTMLInputElement = tag({
		tag: "input",
		class: [css.searchInput, {
			[css.expanded!]: props.isSearchActive
		}],
		onChange: () => props.searchText.set(input.value),
		onKeyup: () => props.searchText.set(input.value),
		onKeydown: e => {
			if(e.key === "Escape"){
				input.blur()
			}
		}
	})

	return tag({class: css.searchBar}, [
		input,
		IconButton({
			icon: Icon.search,
			class: css.searchButton,
			onClick: () => {
				props.isSearchActive.set(!props.isSearchActive.get())
				requestAnimationFrame(() => {
					if(input.isConnected){
						input.focus()
					}
				})
			}
		})
	])
}