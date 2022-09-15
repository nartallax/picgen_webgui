import {addPrototypeToFunction} from "client/base/add_prototype_to_function"
import {BoxNotificationStack} from "client/base/box_notification_stack"

type SubscriberHandlerFn<T = unknown> = (value: T) => void
type UnsubscribeFn = () => void


interface RBoxFields<T>{
	/** Subscribe to receive new value every time it changes
	 * Returns function that will remove the subscription */
	subscribe(handler: SubscriberHandlerFn<T>): UnsubscribeFn

	/** Get a box that will update every time value of this box updates
	 * It is different from `viewBox(mapper)` because mapped box will only depend on source box
	 * (`viewBox(mapper)` will depend on all the boxes that mapper calls, which may be more than just this) */
	map<R>(mapper: (value: T) => R): RBox<R>

	/** Each time stored value changes, revision is incremented
	 * Can be used to track if value is changed or not without actually storing value */
	readonly revision: number

	/** Property box, like WBox can produce, just for RBox they are read-only as well */
	prop<K extends keyof T & (string | symbol)>(propKey: K): RBox<T[K]>
	prop<K extends keyof T & number>(propKey: K): RBox<T[K] | undefined>
}
type RBoxCallSignature<T> = () => T

/** Readonly box. You can only look at the value and subscribe to it, but not change that value directly.
 * Behind this interface could be writeable box, or viewBox, or something else entirely. */
export type RBox<T> = RBoxCallSignature<T> & RBoxFields<T>


interface WBoxFields<T> extends RBoxFields<T>{
	/** Make property box, a box that contains a value of a property of an object of the value from the current box.
	 * New box will be linked with the source box, so they will update accordingly.
	 * Note that if the value of this box is array, value of new box can be undefined.
	 * Another caveat of the array prop() method is that it is bound to the index, not to the value */
	prop<K extends keyof T & (string | symbol)>(propKey: K): WBox<T[K]>
	prop<K extends keyof T & number>(propKey: K): WBox<T[K] | undefined>

	/** This really helps Typescript sometimes better infer stuff */
	readonly thisHelpsTypings?: true
}
type WBoxCallSignature<T> = RBoxCallSignature<T> & ((newValue: T) => T)

/** Writeable box. Box that you can put value in, as well as look at value inside it and subscribe to it. */
export type WBox<T> = WBoxCallSignature<T> & WBoxFields<T>


export type RBoxOrValue<T> = T | RBox<T>
export type MaybeRBoxed<T> = [T] extends [RBox<unknown>] ? T : T | RBox<T>
export type WBoxOrValue<T> = T | WBox<T>

/** Make a simple writeable box */
export const box: <T>(value: T) => WBox<T> = makeValueBox
/** Make a viewBox, a box that recalculates its value each time any of dependencies changed
 * In most of cases you can safely omit @param explicitDependencyList
 * dependency list will be inferred automatically for you from the computing function */
export const viewBox: <T>(computingFn: () => T, explicitDependencyList?: readonly RBox<unknown>[]) => RBox<T> = makeViewBox

export function isWBox<T>(x: unknown): x is WBox<T> {
	return x instanceof ValueBox
}

export function isRBox<T>(x: unknown): x is RBox<T> {
	return x instanceof BoxBase
}

export function unbox<T>(x: RBox<T> | T): T
export function unbox<T>(x: RBox<T> | T | undefined): T | undefined
export function unbox<T>(x: RBox<T> | T | null): T | null
export function unbox<T>(x: RBox<T> | T | null | undefined): T | null | undefined
export function unbox<T>(x: RBox<T> | T): T {
	return isRBox(x) ? x() : x
}


/*
============================================================================================
====== Here public part of box interface ends. Below are gory implementation details. ======
============================================================================================
*/

type NoValue = symbol
const noValue: NoValue = Symbol()

interface ExternalSubscriber<T>{
	lastKnownRevision: number
	lastKnownValue: T
	handler: SubscriberHandlerFn<T>
}

interface InternalSubscriber<T> extends ExternalSubscriber<T>{
	// those props are here to compare if we should notify when pushing updates
	box: RBoxBase<unknown>
}

const notificationStack = new BoxNotificationStack<RBox<unknown>>()

/** Base for every Box */
abstract class BoxBase<T> {

	/** Revision is incremented each time value changes */
	revision = 1

	/** Internal subscribers are subscribers that make up a graph of boxes */
	private internalSubscribers = new Set<InternalSubscriber<T>>()
	/** External subscribers are subscribers that receive data outside of boxes graph */
	private externalSubscribers = new Set<ExternalSubscriber<T>>()

	constructor(public value: T | NoValue) {}

	haveSubscribers(): boolean {
		return this.internalSubscribers.size > 0 || this.externalSubscribers.size > 0
	}

	doSubscribe<B>(external: boolean, handler: SubscriberHandlerFn<T>, box?: RBoxBase<B>): UnsubscribeFn {
		const value = this.value
		if(value === noValue){
			throw new Error("Cannot subscribe to box: no value!")
		}

		if(external){
			const sub: ExternalSubscriber<T> = {
				handler,
				lastKnownRevision: this.revision,
				lastKnownValue: value as T
			}
			this.externalSubscribers.add(sub)
			return () => this.externalSubscribers.delete(sub)
		} else {
			if(!box){
				throw new Error("Assertion failed")
			}
			const sub: InternalSubscriber<T> = {
				handler, box: box as RBoxBase<unknown>,
				lastKnownRevision: this.revision,
				lastKnownValue: value as T
			}
			this.internalSubscribers.add(sub)
			return () => this.internalSubscribers.delete(sub)
		}
	}

	subscribe(handler: SubscriberHandlerFn<T>): UnsubscribeFn {
		return this.doSubscribe(true, handler)
	}

	tryChangeValue<B>(value: T, box?: RBoxBase<B>): void {
		// yes, objects can be changed without the change of reference, so this check will fail on such change
		// it is explicit decision. that way, better performance can be achieved.
		// because it's much better to explicitly ask user to tell us if something is changed or not
		// (by cloning the object, changing the clone and setting the clone back into the box)
		// otherwise (in cases of large box graphs) it may lead to awfully degraded performance
		const valueChanged = this.value !== value
		this.value = value
		if(valueChanged){
			this.revision++
			this.notify(value, box)
		}
	}

	notify<B>(value: T, box: RBoxBase<B> | undefined): void {
		const valueRevision = this.revision

		for(const sub of this.internalSubscribers){
			// if the notification came from the same box - we should not notify it again
			if(sub.box === box){
				continue
			}

			this.maybeCallSubscriber(sub, value, valueRevision)
		}

		if(valueRevision < this.revision){
			// this simple cutoff will only work well for external subscribers
			// for anything else there is a risk of not invoking a subscriber at all
			// (this check is a simple optimisation and can be turned off without noticeable change in behaviour)
			return
		}

		for(const sub of this.externalSubscribers){
			this.maybeCallSubscriber(sub, value, valueRevision)
		}

	}

	private maybeCallSubscriber(sub: ExternalSubscriber<T>, value: T, valueRevision: number): void {
		if(sub.lastKnownRevision > valueRevision){
			return
		}

		// revision update should be strictly BEFORE content diff cutoff
		// because if we detect that value is the same and there is previous notify iteration running with different value,
		// then, without updating revision, that older iteration will invoke the handler with outdated value
		// which is big no-no
		sub.lastKnownRevision = valueRevision
		if(sub.lastKnownValue === value){
			return
		}
		sub.lastKnownValue = value
		sub.handler(value)
	}

	map<R>(this: RBox<T>, mapper: (value: T) => R): RBox<R> {
		return makeViewBox(() => mapper(this()), [this])
	}

}

type RBoxBase<T> = BoxBase<T> & RBox<T>

/** Just a box that just contains value */
class ValueBox<T> extends (BoxBase as {
	new<T>(value: T | NoValue): BoxBase<T> & WBoxCallSignature<T> & RBoxCallSignature<T>
})<T> implements WBoxFields<T> {

	prop<K extends keyof T & (string | symbol)>(propKey: K): WBox<T[K]>
	prop<K extends keyof T & number>(propKey: K): WBox<T[K] | undefined>
	prop<K extends keyof T>(propKey: K): WBox<T[K]> {
		// by the way, I could store propbox in some sort of map in the parent valuebox
		// and later, if someone asks for propbox for the same field, I'll give them the same propbox
		// this will simplify data logistics a little and possibly reduce memory consumption
		// however, I don't want to do that because it's relatively rare case - to have two propboxes on same field at the same time
		// and storing a reference to them in the parent will make them uneligible for GC, which is not very good
		// (not very bad either, there's a finite amount of them. but it's still something to avoid)
		let boxObj: FixedPropValueBox<T, K>
		const weAreArray = Array.isArray(this.value)
		const propertyIsNumber = typeof(propKey) === "number"
		// few bad casts here. eww.
		if(weAreArray && propertyIsNumber){
			boxObj = new FixedArrayPropValueBox<unknown>(this as unknown as ValueBox<unknown[]>, propKey as K & number) as unknown as FixedPropValueBox<T, K>
		} else if(!weAreArray && !propertyIsNumber){
			boxObj = new FixedObjectPropValueBox(this, propKey as K & (string | symbol)) as unknown as FixedPropValueBox<T, K>
		} else {
			throw new Error(`Value of the box is ${weAreArray ? "" : "not "}array, but the property key is ${propertyIsNumber ? "" : "not "}number. This is inconsistent and not allowed.`)
		}
		return makeUpstreamBox(boxObj)
	}

}

/** Box that is subscribed to one other box only when it has its own subscriber(s)
 * Usually that other box is viewed as upstream; source of data that this box is derived from */
abstract class ValueBoxWithUpstream<T, U = unknown> extends ValueBox<T> {

	private upstreamUnsub: UnsubscribeFn | null = null
	constructor(readonly upstream: ValueBox<U>) {
		super(noValue)
	}

	protected abstract extractValueFromUpstream(upstreamObject: U): T
	protected abstract buildUpstreamValue(value: T): U

	protected shouldBeSubscribed(): boolean {
		return this.haveSubscribers()
	}

	getBoxValue(): T {
		if(this.value !== noValue){
			return this.value as T
		} else {
			// if we are called from view calc function - we should prevent view to access our upstream box
			// so view will only subscribe to this box, but not to the parent
			return notificationStack.withAccessNotifications(() => this.extractValueFromUpstream(this.upstream()), null)
		}
	}

	protected getUpstreamValue(): U {
		return notificationStack.withAccessNotifications(() => this.upstream(), null)
	}

	tryUpdateUpstreamSub(): void {
		const shouldBeSub = this.shouldBeSubscribed()
		if(shouldBeSub && !this.upstreamUnsub){
			this.subToParent()
		} else if(!shouldBeSub && this.upstreamUnsub){
			this.unsubFromParent()
		}
	}

	private unsubFromParent() {
		if(!this.upstreamUnsub){
			throw new Error("Assertion failed")
		}
		this.upstreamUnsub()
		this.upstreamUnsub = null
		this.value = noValue
	}

	private subToParent(): void {
		if(this.upstreamUnsub){
			throw new Error("Assertion failed")
		}
		if(this.value === noValue){
			this.value = this.getBoxValue()
		}
		this.upstreamUnsub = this.upstream.doSubscribe(false, v => {
			const ourValue = this.extractValueFromUpstream(v)
			this.tryChangeValue(ourValue, this.upstream)
		}, this)
	}

	override doSubscribe<B>(external: boolean, handler: SubscriberHandlerFn<T>, box?: RBoxBase<B>): UnsubscribeFn {
		if(this.value === noValue){
			this.value = this.getBoxValue()
		}
		const unsub = super.doSubscribe(external, handler, box)
		this.tryUpdateUpstreamSub()
		return () => {
			unsub()
			this.tryUpdateUpstreamSub()
		}
	}

	override notify<B>(value: T, box: RBoxBase<B> | undefined): void {
		// it's kinda out of place, but anyway
		// if this box have no subscribers - it should never store value
		// because it also don't subscribe to upstream in that case (because amount of subscriptions should be minimised)
		if(!this.shouldBeSubscribed()){
			this.value = noValue
		}

		// this is also a little out of place
		// think of this block as a notification to parent that child value is changed
		// (although this is not conventional call to subscription)
		if(box as unknown !== this.upstream){
			const upstreamObject = this.buildUpstreamValue(value)
			this.upstream.tryChangeValue(upstreamObject, this)
		}

		super.notify(value, box)
	}

}

abstract class FixedPropValueBox<U, K extends keyof U> extends ValueBoxWithUpstream<U[K], U> {

	constructor(upstream: ValueBox<U>, protected readonly propKey: K) {
		super(upstream)
	}

	protected override extractValueFromUpstream(upstreamObject: U): U[K] {
		return upstreamObject[this.propKey]
	}

}

class FixedObjectPropValueBox<U, K extends keyof U & (string | symbol)> extends FixedPropValueBox<U, K> {
	protected override buildUpstreamValue(value: U[K]): U {
		const upstreamObject = this.getUpstreamValue()
		if(Array.isArray(upstreamObject)){
			throw new Error(`Upstream object became an array! Cannot properly clone it to set the property "${this.propKey.toString()}" value.`)
		}
		return {
			...upstreamObject,
			[this.propKey]: value
		}
	}
}

class FixedArrayPropValueBox<E> extends FixedPropValueBox<E[], number> {

	protected override buildUpstreamValue(value: E): E[] {
		const upstreamObject = this.getUpstreamValue()
		if(!Array.isArray(upstreamObject)){
			throw new Error(`Upstream object is not array anymore! Cannot properly clone it to set the property "${this.propKey}" value.`)
		}
		const newArr = [...upstreamObject]
		newArr[this.propKey] = value
		return newArr
	}
}

// TODO: test two array element value boxes on same prop key... is this possible at all?
// or something like array element value box and just prop box. will the updates travel properly?
// class ArrayElementValueBox<T, K extends keyof T> extends ValueBoxWithUpstream<T, T[]> {

// 	constructor(readonly keyValue: T[K], public index: number, upstream: ValueBox<T[]>) {
// 		super(upstream, undefined)
// 	}

// 	protected override extractValueFromUpstream(upstreamObject: T[]): T {

// 	}

// }

function makeUpstreamBox<T, U>(instance: ValueBoxWithUpstream<T, U>): ValueBoxWithUpstream<T, U> {

	function upstreamValueBox(...args: T[]): T {
		if(args.length === 0){
			notificationStack.notifyOnAccess(result)
		} else {
			result.tryChangeValue(args[0]!)
		}

		const boxvalue = result.getBoxValue()
		return boxvalue
	}

	const result = addPrototypeToFunction(upstreamValueBox, instance)

	return result
}

function makeValueBox<T>(value: T): ValueBox<T> {

	function valueBox(...args: T[]): T {
		if(args.length < 1){
			notificationStack.notifyOnAccess(result)
		} else {
			result.tryChangeValue(args[0]!)
		}

		if(result.value === noValue){
			// should never happen
			throw new Error("After executing valueBox the value is absent!")
		}

		return result.value as T
	}

	const result = addPrototypeToFunction(valueBox, new ValueBox(value))

	return result
}


class ViewBox<T> extends (BoxBase as {
	new<T>(value: T | NoValue): BoxBase<T> & RBoxCallSignature<T>
})<T> implements RBoxFields<T> {

	/*
	Here it gets a little tricky.
	Lifetime of the view is by definition lower than lifetime of values it depends on
	(because those values are referenced through closure expression of the view)
	But when every external reference to the view is gone, it should be eligible to get GCed
	which is not possible if it stays subscribed, because subscription will hold a reference to the view
	(it is btw typical "lapsed listeners" problem)

	To avoid this we employ the following tactics:
	1. view don't store ANYTHING when noone is subscribed (no list of dependencies, no value, nothing)
	in this mode view just calls computing function when asked for the value
	2. when we HAVE subscribers to view - value is stored, list of dependencies is stored
	view returns stored value when asked for value in this mode

	This way, you only need to remove all subscribers from view for it to be eligible to be GCed
	*/
	private subDisposers: UnsubscribeFn[] = []
	private onDependencyListUpdated: null | (() => void) = null

	constructor(
		private readonly computingFn: () => T,
		private readonly explicitDependencyList: readonly RBox<unknown>[] | undefined) {
		super(noValue)
	}

	private subDispose(): void {
		this.subDisposers.forEach(x => x())
		this.subDisposers.length = 0
	}

	private shouldRecalcValue(): boolean {
		if(this.value === noValue){
			return true // no value? let's recalculate
		}

		if(this.subDisposers.length === 0){
			// we are not subscribed to anyone
			// that means calcFunction either is constant expression, or depends on some plain variables that can change
			// better recalculate
			return true
		}

		return false // we have value, no need to do anything
	}

	private recalcValueAndResubscribe(): T {
		this.subDispose()

		let newValue: T
		let depList: readonly RBox<unknown>[]
		if(!this.explicitDependencyList){
			const boxesAccessed = new Set<RBox<unknown>>()
			newValue = notificationStack.withAccessNotifications(this.computingFn, box => boxesAccessed.add(box))
			depList = [...boxesAccessed]
		} else {
			newValue = notificationStack.withAccessNotifications(this.computingFn, null)
			depList = this.explicitDependencyList
		}

		if(depList.length > 0){
			const doOnDependencyUpdated = this.onDependencyListUpdated ||= () => this.recalcValueAndResubscribe()
			for(let i = 0; i < depList.length; i++){
				this.subDisposers.push(depList[i]!.subscribe(doOnDependencyUpdated))
			}
		}

		// we can safely not pass a box here
		// because box is only used to prevent notifications to go back to original box
		// and we should never be subscribed to itself, because it's not really possible
		this.tryChangeValue(newValue)

		return newValue
	}

	override doSubscribe<B>(external: boolean, handler: SubscriberHandlerFn<T>, box?: RBoxBase<B> | undefined): UnsubscribeFn {
		if(!this.haveSubscribers()){
			this.recalcValueAndResubscribe()
		}
		const disposer = super.doSubscribe(external, handler, box)
		return () => {
			disposer()
			if(!this.haveSubscribers()){
				this.subDispose()
				this.value = noValue
			}
		}
	}

	getValue(): T {
		notificationStack.notifyOnAccess(this)

		if(!this.shouldRecalcValue()){
			return this.value as T
		}

		return notificationStack.withAccessNotifications(this.computingFn, null)
	}

	prop<K extends keyof T>(propKey: K): RBox<T[K]> {
		return this.map(v => v[propKey])
	}

}

function makeViewBox<T>(computingFn: () => T, explicitDependencyList?: readonly RBox<unknown>[]): ViewBox<T> {
	function viewBox(): T {
		return result.getValue()
	}

	const result = addPrototypeToFunction(viewBox, new ViewBox(computingFn, explicitDependencyList))
	return result
}
