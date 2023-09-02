import {RBox, WBox, calcBox, isWBox} from "@nartallax/cardboard"
import {defineControl, tag} from "@nartallax/cardboard-dom"
import {Icon} from "client/generated/icons"
import * as css from "./lock_button.module.scss"
import {GenParameterGroup, GenerationParameterSet} from "common/entities/parameter"
import {lockedParameters} from "client/app/global_values"

type Props = {
	readonly isLocked: RBox<boolean>
	readonly onChange?: (isGroupChange: boolean) => void
}

export function makeGroupLockBox(locks: readonly WBox<boolean>[]): RBox<boolean> {
	return calcBox(locks, (...locks) => locks.reduce((a, b) => a && b, true))
}

export function getSetLockBoxes(paramSet: GenerationParameterSet): WBox<boolean>[] {
	const result = paramSet.parameterGroups.flatMap(group => getGroupLockBoxes(paramSet, group))
	result.push(getLockBox(paramSet, paramSet.primaryParameter.jsonName))
	return result
}

export function isParameterLocked(paramSet: GenerationParameterSet, name: string): boolean {
	return lockedParameters.get()[paramSet.internalName + "." + name] === true
}

export function getGroupLockBoxes(paramSet: GenerationParameterSet, group: GenParameterGroup): WBox<boolean>[] {
	const result: WBox<boolean>[] = []
	for(const param of group.parameters){
		result.push(getLockBox(paramSet, param.jsonName))
	}
	if(group.toggle?.jsonName){
		result.push(getLockBox(paramSet, group.toggle.jsonName))
	}
	return result
}

export function getLockBox(paramSet: GenerationParameterSet, paramName: string): WBox<boolean> {
	const lockBox = lockedParameters.prop(paramSet.internalName + "." + paramName)
	if(lockBox.get() === undefined){
		lockBox.set(false)
	}
	return lockBox
}

export const LockButton = defineControl((props: Props) => {
	if(!props.onChange && !isWBox(props.isLocked)){
		throw new Error("Incorrect LockButton props: could not change locked status in any way")
	}

	const result = tag({
		class: [css.lockButton, {
			[Icon.lockLocked]: props.isLocked,
			[Icon.lockUnlocked]: props.isLocked.map(x => !x)
		}]
	})

	result.addEventListener("mousedown", e => e.preventDefault())

	result.addEventListener("click", e => {
		if(props.onChange){
			props.onChange(!!e.ctrlKey || !!e.shiftKey)
		} else if(isWBox(props.isLocked)){
			props.isLocked.set(!props.isLocked.get())
		}
	})

	return result
})