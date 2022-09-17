import {Binder, getBinder} from "client/base/binder/binder"
import {isRBox, MaybeRBoxed, RBox, unbox, WBox} from "client/base/box"
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

export type HtmlTaggable = HTMLElement | Control | null | undefined

type ChildArray = HtmlTaggable[] | RBox<HtmlTaggable[]>

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
	} else if(Array.isArray(a) || isRBox(a)){
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
		binder = makeClassname(binder, res, description.class, classname => res.className = classname) || binder
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
	}

	if(children){
		const setChildren = (children: HtmlTaggable[]) => {
			const childTags = children.filter(x => !!x).map(x => isControl(x) ? x.el : x) as HTMLElement[]
			updateChildren(res, childTags)
		}

		if(isRBox(children)){
			(binder ||= getBinder(res)).watch(children, children => {
				setChildren(children)
			})
		}
		setChildren(unbox(children))
	}

	return res as HTMLElementTagNameMap[K]
}

export function taggableToTag(taggable: HtmlTaggable): HTMLElement | null {
	if(!taggable){
		return null
	}
	return taggable instanceof HTMLElement ? taggable : isControl(taggable) ? taggable.el : tag(taggable)
}

function updateChildren(parent: HTMLElement, newChildren: readonly HTMLElement[]): void {
	for(let i = 0; i < newChildren.length; i++){
		const childTag = newChildren[i]!
		const x = parent.children[i]
		if(x === childTag){
			continue
		}
		if(x){
			parent.insertBefore(childTag, x)
		} else {
			parent.appendChild(childTag)
		}
	}

	while(parent.children[newChildren.length]){
		parent.children[newChildren.length]!.remove()
	}
}

/** Cached renderer for list of elements
 * Won't re-render an element if already has one for the value */
export function renderArray<T, K>(src: WBox<T[]>, getKey: (value: T) => K, render: (value: WBox<T>) => HTMLElement): RBox<HTMLElement[]>
export function renderArray<T, K>(src: RBox<T[]>, getKey: (value: T) => K, render: (value: RBox<T>) => HTMLElement): RBox<HTMLElement[]>
export function renderArray<T, K>(src: WBox<T[]>, getKey: (value: T) => K, render: (value: WBox<T>) => HTMLElement): RBox<HTMLElement[]> {
	const map = new Map<WBox<T>, HTMLElement>()

	return src.wrapElements(getKey).map(itemBoxes => {
		const leftoverBoxes = new Set(map.keys())

		const result = itemBoxes.map(itemBox => {
			leftoverBoxes.delete(itemBox)
			let el = map.get(itemBox)
			if(!el){
				el = render(itemBox)
				map.set(itemBox, el)
			}
			return el
		})

		for(const oldBox of leftoverBoxes){
			map.delete(oldBox)
		}

		return result
	})
}