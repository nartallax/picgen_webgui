import {Binder, getBinder} from "client/base/binder/binder"
import {isRBox, MaybeRBoxed, unbox} from "client/base/box"
import {ClassNameParts, makeClassname} from "client/base/classname"
import {Control, isControl} from "client/base/control"

export interface HTMLTagDescription<K extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap> {
	readonly tagName?: K
	readonly text?: MaybeRBoxed<string | number>
	readonly class?: ClassNameParts
	readonly attrs?: {
		readonly [attrName: string]: MaybeRBoxed<string | number>
	}
	readonly on?: {
		readonly [k in keyof GlobalEventHandlersEventMap]?: (evt: GlobalEventHandlersEventMap[k]) => void
	}
	readonly style?: {
		readonly [k in keyof CSSStyleDeclaration]?: MaybeRBoxed<CSSStyleDeclaration[k]>
	}
}

export type HtmlTaggable = HTMLElement | HTMLTagDescription | Control | null | undefined

type ChildArray = HtmlTaggable[]

export function tag(): HTMLDivElement
export function tag<K extends keyof HTMLElementTagNameMap = "div">(description: HTMLTagDescription<K>): HTMLElementTagNameMap[K]
export function tag(children: ChildArray): HTMLDivElement
export function tag<K extends keyof HTMLElementTagNameMap = "div">(description: HTMLTagDescription<K>, children: ChildArray): HTMLElementTagNameMap[K]

export function tag<K extends keyof HTMLElementTagNameMap = "div">(a?: HTMLTagDescription<K> | ChildArray, b?: ChildArray): HTMLElementTagNameMap[K] {
	let description: HTMLTagDescription<K>
	let children: ChildArray | undefined = undefined
	if(!a){
		description = {}
		children = b || undefined
	} else if(Array.isArray(a)){
		description = {}
		children = a
	} else {
		description = a
		children = b || undefined
	}

	const res = document.createElement(description.tagName || "div")

	let binder: Binder | null = null

	if(description.text){
		const text = description.text
		if(isRBox(text)){
			(binder ||= getBinder(res)).watch<string | number>(text, text => {
				res.textContent = text + ""
			})
		}
		res.textContent = unbox(text) + ""
	}

	if(description.class){
		binder = binder || makeClassname(binder, res, description.class, classname => res.className = classname)
	}

	if(description.on){
		for(const evtName in description.on){
			const handler = description.on[evtName as keyof GlobalEventHandlersEventMap]
			// I don't want to construct elaborat solid type here
			// I know you will be in correct type, because it enforced by function parameter type
			// so just be Any and that's it
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			res.addEventListener(evtName, handler as any, {passive: true, capture: false})

		}
	}

	if(description.style){
		for(const k in description.style){
			const v = description.style[k]
			if(isRBox(v)){
				(binder ||= getBinder(res)).watch<string | number>(v, v => {
					res.style[k] = v as string // ew
				})
			}
			res.style[k] = unbox(description.style[k]!)
			break


		}
	}

	for(const k in description.attrs){
		const v = description.attrs[k]
		if(isRBox(v)){
			(binder ||= getBinder(res)).watch<string | number>(v, v => {
				res.setAttribute(k, v + "")
			})
		}
		res.setAttribute(k, unbox(v) + "")
		break
	}

	if(children){
		for(const child of children){
			if(!child){
				continue
			}
			res.appendChild(child instanceof HTMLElement ? child : isControl(child) ? child.el : tag(child))
		}
	}

	return res as HTMLElementTagNameMap[K]
}

export function taggableToTag(taggable: HtmlTaggable): HTMLElement | null {
	if(!taggable){
		return null
	}
	return taggable instanceof HTMLElement ? taggable : isControl(taggable) ? taggable.el : tag(taggable)
}