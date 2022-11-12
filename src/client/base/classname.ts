import {Binder, getBinder} from "client/base/binder/binder"
import {isRBox, MaybeRBoxed, unbox} from "client/base/box"

type ClassNamePart = MaybeRBoxed<string | null | undefined> | Record<string, MaybeRBoxed<boolean | undefined>>
export type ClassNameParts = ClassNamePart | ClassNamePart[]

/** Utility function that assembles classname from parts */
export function makeClassname(binder: Binder | null, node: Node, parts: ClassNameParts, callback: (className: string) => void): Binder | null {
	const arr = Array.isArray(parts) ? parts : [parts]
	for(const item of arr){
		if(isRBox(item)){
			(binder ||= getBinder(node)).watch(item, makeClassnameAndCallTheCallback)
		} else if(item && typeof(item) === "object"){
			for(const key in item){
				const bool = item[key]
				if(isRBox(bool)){
					(binder ||= getBinder(node)).watch(bool, makeClassnameAndCallTheCallback)
				}
			}
		}
	}

	function makeClassnameAndCallTheCallback() {
		const result = []
		for(const item of arr){
			if(item && typeof(item) === "object"){
				for(const classname in item){
					if(unbox(item[classname])){
						result.push(classname)
					}
				}
			} else {
				const classname = unbox(item)
				if(classname){
					result.push(classname)
				}
			}
		}
		callback(result.join(" "))
	}

	makeClassnameAndCallTheCallback()

	return binder
}