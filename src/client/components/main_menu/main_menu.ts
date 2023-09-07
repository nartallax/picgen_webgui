import {RBox, WBox} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {AdminButtons} from "client/components/admin_buttons/admin_buttons"
import {ArgumentsInputBlock} from "client/components/arguments_input_block/arguments_input_block"
import {LoginBar} from "client/components/login_bar/login_bar"
import {MainMenuButton} from "client/components/main_menu/main_menu_button"
import {PasteArgumentsButton} from "client/components/paste_arguments_button/paste_arguments_button"
import {Row} from "client/controls/layout/row_col"
import {LockButton, getSetLockBoxes, makeGroupLockBox} from "client/controls/lock_button/lock_button"
import {Select} from "client/controls/select/select"
import {Sidebar} from "client/controls/sidebar/sidebar"
import * as css from "./main_menu.module.scss"
import {allKnownParamSets, currentParamSetName} from "client/app/global_values"
import {GenerationParameterSet} from "common/entities/parameter"

interface Props {
	readonly isOpen: WBox<boolean>
	readonly selectedParamSet: RBox<GenerationParameterSet>
}

export const MainMenu = (props: Props) => Sidebar({isOpen: props.isOpen}, [
	tag({class: css.mainMenu}, [
		Row({align: "start"}, [
			MainMenuButton({isOpen: props.isOpen}),
			LoginBar(),
			PasteArgumentsButton()
		]),
		Row({class: css.propSetSelector, align: "stretch", gap: true}, [
			props.selectedParamSet.map(paramSet => {
				const setLocks = getSetLockBoxes(paramSet)
				const groupLock = makeGroupLockBox(setLocks)
				return LockButton({
					isLocked: groupLock,
					onChange: () => {
						const shouldBeLocked = !groupLock.get()
						for(const lock of setLocks){
							lock.set(shouldBeLocked)
						}
					}
				})
			}),
			Select({
				class: css.paramSetSelect,
				options: allKnownParamSets.map(sets => sets.map(set => ({
					label: set.uiName,
					value: set.internalName
				}))),
				value: currentParamSetName
			})
		]),
		tag({class: css.mainMenuScrollablePart}, [
			ArgumentsInputBlock({paramSet: props.selectedParamSet}),
			AdminButtons()
		])
	])
])