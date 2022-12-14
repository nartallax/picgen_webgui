import {MutationBinder} from "client/base/binder/mutation_binder"
import {isRBox, RBox} from "client/base/box"
import {makeNodeDataAttacher} from "client/base/node_data_attacher"

/** Binder is a way to access various lifecycle events of DOM nodes
 * Through that it can help with subscription to various stuff like boxes */
export interface Binder {
	onNodeInserted(handler: () => void): void
	onNodeRemoved(handler: () => void): void
	onNodeInsertedOnce(handler: () => void): void
	onNodeRemovedOnce(handler: () => void): void
	clearOnNodeInserted(handler: () => void): void
	clearOnNodeRemoved(handler: () => void): void
	watch<T>(box: RBox<T>, handler: (value: T) => void): () => void
	watchAndRun<T>(box: RBox<T>, handler: (value: T) => void): () => void
	readonly isInDom: boolean
}

const noValue = Symbol()
type NoValue = typeof noValue

interface WatchedBox<T = unknown>{
	readonly box: RBox<T>
	handler(value: T): void
	lastKnownValue: T | NoValue
	unsub: (() => void) | null
}

export class BinderImpl implements Binder {
	private insertedHandlers = null as null | (() => void)[]
	private removedHandlers = null as null | (() => void)[]
	private watchedBoxes = null as null | WatchedBox[]
	isInDom: boolean

	constructor(readonly el: Node) {
		this.isInDom = nodeIsInDom(el)
	}

	onNodeInserted(handler: () => void): void {
		(this.insertedHandlers ||= []).push(handler)
	}
	onNodeRemoved(handler: () => void): void {
		(this.removedHandlers ||= []).push(handler)
	}

	onNodeInsertedOnce(handler: () => void): void {
		const wrappedHandler = () => {
			try {
				handler()
			} finally {
				this.clearOnNodeInserted(wrappedHandler)
			}
		}

		this.onNodeInserted(wrappedHandler)
	}
	onNodeRemovedOnce(handler: () => void): void {
		const wrappedHandler = () => {
			try {
				handler()
			} finally {
				this.clearOnNodeRemoved(wrappedHandler)
			}
		}

		this.onNodeRemoved(wrappedHandler)
	}

	clearOnNodeInserted(handler: () => void): void {
		this.insertedHandlers = dropItemFromArray(this.insertedHandlers, handler)
	}
	clearOnNodeRemoved(handler: () => void): void {
		this.removedHandlers = dropItemFromArray(this.removedHandlers, handler)
	}

	fireNodeInserted(): void {
		this.isInDom = true
		const boxes = this.watchedBoxes
		if(boxes){
			for(let i = 0; i < boxes.length; i++){
				const box = boxes[i]!
				const value = box.box()
				if(box.lastKnownValue !== value){
					this.invokeBoxHandler(value, box)
				}
				this.subToBox(box)
			}
		}

		fireAll(this.insertedHandlers)
	}

	fireNodeRemoved(): void {
		this.isInDom = false
		const boxes = this.watchedBoxes
		if(boxes){
			for(let i = 0; i < boxes.length; i++){
				const box = boxes[i]!
				box.unsub!()
			}
		}

		fireAll(this.removedHandlers)
	}

	private invokeBoxHandler<T>(value: T, box: WatchedBox<T>): void {
		box.handler(value)
		box.lastKnownValue = value
	}

	private subToBox(box: WatchedBox): void {
		box.unsub = box.box.subscribe(v => this.invokeBoxHandler(v, box))
	}

	private _subscribe<T>(box: RBox<T>, handler: (value: T) => void): {unsub(): void, watchedBox: WatchedBox} {
		const watchedBox: WatchedBox = {
			box,
			handler,
			lastKnownValue: noValue,
			unsub: null
		}
		if(this.isInDom){
			this.subToBox(watchedBox)
		}
		(this.watchedBoxes ||= []).push(watchedBox)
		return {
			unsub: () => {
				this.watchedBoxes = dropItemFromArray(this.watchedBoxes, watchedBox)
			},
			watchedBox
		}
	}

	watch<T>(box: RBox<T>, handler: (value: T) => void): () => void {
		return this._subscribe(box, handler).unsub
	}

	watchAndRun<T>(box: T | RBox<T>, handler: (value: T) => void): () => void {
		if(isRBox(box)){
			const {unsub, watchedBox} = this._subscribe(box, handler)
			this.invokeBoxHandler(box(), watchedBox)
			return unsub
		} else {
			handler(box)
			return () => {
				// noop!
			}
		}
	}

}

const binderStorage = makeNodeDataAttacher<BinderImpl>("__binder_of_this_node")
const mutationBinder = new MutationBinder(binderStorage)

export function getBinder(el: Node): Binder {
	mutationBinder.init()
	let binder = binderStorage.get(el)
	if(!binder){
		binder = new BinderImpl(el)
		binderStorage.set(el, binder)
	}
	return binder
}

// yeah, not very effective
// though in real applications removal of something from watch list is not frequent operation
// so, whatever
function dropItemFromArray<T>(arr: T[] | null, item: T): T[] | null {
	if(!arr || (arr.length === 1 && arr[0] === item)){
		return null
	}
	const result = [] as T[]
	for(let i = 0; i < arr.length; i++){
		const el = arr[i]!
		if(el !== item){
			result.push(el)
		}
	}
	return result
}

function nodeIsInDom(node: Node): boolean {
	let parent = node.parentNode
	while(parent){
		if(parent === document.body){
			return true
		}
		parent = parent.parentNode
	}
	return false
}

function fireAll(handlers: (() => void)[] | null): void {
	if(!handlers){
		return
	}
	for(let i = 0; i < handlers.length; i++){
		handlers[i]!()
	}
}