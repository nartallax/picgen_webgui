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

export function unbox<T>(x: RBoxOrValue<T>): T {
	return isRBox(x) ? x() : x
}


/*
============================================================================================
====== Here public part of box interface ends. Below are gory implementation details. ======
============================================================================================
*/

/** Direction of data flow. It represents a relation between two boxes
 *
 * A box may want to internally push an update to other boxes,
 * and direction determines, how this push will trigger other listeners of the same box.
 *
 * This idea about directions is required to prevent infinite update loops, especially important in case of object-values that cannot be thoroughly compared */
export enum BoxDataFlowDirection {
	/** Technically, not a relation between two boxes
	 * Is here just to represent direction from where the update came from */
	external = 0,
	/** Child-parent flow direction (property and object containing the property)
	 * Update from child will not trigger other children (except for the same field)
	 * Update from parent won't trigger parent listeners */
	child = 1,
	parent = 2,

	/** Clone-original flow direction
	 * Update from clone won't trigger this clone listener.
	 * Update from original won't trigger this original listener. */
	clone = 3,
	original = 4
}

type NoValue = symbol
const noValue: NoValue = Symbol()
type PropKey = string | number | symbol

interface ExternalSubscriber<T>{
	lastKnownRevision: number
	lastKnownValue: T
	handler: SubscriberHandlerFn<T>
}

interface InternalSubscriber<T> extends ExternalSubscriber<T>{
	// those props are here to compare if we should notify when pushing updates
	direction: BoxDataFlowDirection
	box: RBox<unknown>
	propKey: PropKey | undefined
}

function boxContentCanBeDifferent<T>(oldValue: T, newValue: T): boolean {
	// we check non-null objects separately
	// because even if reference did not change, some fields could
	return newValue !== oldValue || (typeof(oldValue) === "object" && oldValue !== null)
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

	subscribeWithDirection(direction: BoxDataFlowDirection.external, handler: SubscriberHandlerFn<T>): UnsubscribeFn
	subscribeWithDirection(direction: BoxDataFlowDirection, handler: SubscriberHandlerFn<T>, box: RBox<unknown>, propKey: PropKey | undefined): UnsubscribeFn
	subscribeWithDirection(direction: BoxDataFlowDirection, handler: SubscriberHandlerFn<T>, box?: RBox<unknown>, propKey?: PropKey): UnsubscribeFn {
		const value = this.value
		if(value === noValue){
			throw new Error("Cannot subscribe to box: no value!")
		}

		if(direction === BoxDataFlowDirection.external){
			const sub: ExternalSubscriber<T> = {
				handler,
				lastKnownRevision: this.revision,
				lastKnownValue: value as T
			}
			this.externalSubscribers.add(sub)
			return () => this.externalSubscribers.delete(sub)
		} else {
			const sub: InternalSubscriber<T> = {
				direction, handler, box: box!, propKey,
				lastKnownRevision: this.revision,
				lastKnownValue: value as T
			}
			this.internalSubscribers.add(sub)
			return () => this.internalSubscribers.delete(sub)
		}
	}

	subscribe(handler: SubscriberHandlerFn<T>): UnsubscribeFn {
		return this.subscribeWithDirection(BoxDataFlowDirection.external, handler)
	}

	tryChangeValue(value: T, from: BoxDataFlowDirection.external): void
	tryChangeValue(value: T, from: BoxDataFlowDirection, box: RBox<unknown>, propKey: PropKey | undefined): void
	tryChangeValue(value: T, from: BoxDataFlowDirection, box?: RBox<unknown>, propKey?: PropKey): void {
		const valueChanged = boxContentCanBeDifferent(this.value, value)
		this.value = value
		if(valueChanged){
			this.revision++
			this.notify(value, from, box, propKey)
		}
	}

	notify(value: T, from: BoxDataFlowDirection, box: RBox<unknown> | undefined, propKey: PropKey | undefined): void {
		const valueRevision = this.revision

		for(const sub of this.internalSubscribers){
			// if the notification came from the same box - we should not notify it again
			if(sub.box === box){
				continue
			}

			// if the notification came from property box - it can only change one property
			// no need to notify other property boxes
			if(from === BoxDataFlowDirection.child && sub.direction === BoxDataFlowDirection.child && sub.propKey !== propKey){
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
		if(!boxContentCanBeDifferent(sub.lastKnownValue, value)){
			return
		}
		sub.lastKnownValue = value
		sub.handler(value)
	}

	map<R>(this: RBox<T>, mapper: (value: T) => R): RBox<R> {
		return makeViewBox(() => mapper(this()), [this])
	}

}

/** Just a box that just contains value */
class ValueBox<T> extends BoxBase<T> implements WBoxFields<T> {

	prop<K extends keyof T>(this: ValueBox<T> & WBox<T>, propKey: K): WBox<T[K]> {
		// by the way, I could store propbox in some sort of map in the parent valuebox
		// and later, if someone asks for propbox for the same field, I'll give them the same propbox
		// this will simplify data logistics a little and possibly reduce memory consumption
		// however, I don't want to do that because it's relatively rare case - to have two propboxes on same field at the same time
		// and storing a reference to them in the parent will make them uneligible for GC, which is not very good
		// (not very bad either, there's a finite amount of them. but it's still something to avoid)
		return makePropBox(this, propKey)
	}

	// clone(): WBox<T> {
	// 	const clone = makeValueBox(this.value)
	// 	// this.subscribeWithDirection(BoxDataFlowDirection.)
	// }

}

/** Box that is subscribed to one other box only when it has its own subscriber(s)
 * Usually that other box is viewed as upstream; source of data that this box is derived from */
abstract class ValueBoxWithUpstream<T, U = unknown, K = PropKey | undefined> extends ValueBox<T> {

	private upstreamUnsub = null as UnsubscribeFn | null
	constructor(readonly upstream: ValueBox<U> & WBox<U>, readonly propKey: K) {
		super(noValue)
	}

	protected abstract getValueFromUpstream(upstreamObject: U): T
	protected abstract setValueIntoUpstream(upstreamObject: U, value: T): void
	protected abstract getUpstreamDirection(): BoxDataFlowDirection
	protected abstract getDownstreamDirection(): BoxDataFlowDirection

	getBoxValue(): T {
		if(this.value !== noValue){
			return this.value as T
		} else {
			// if we are called from view calc function - we should prevent view to access our upstream box
			// so view will only subscribe to this box, but not to the parent
			return notificationStack.withAccessNotifications(() => this.getValueFromUpstream(this.upstream()), null)
		}
	}

	private tryUnsubFromParent() {
		if(!this.haveSubscribers()){
			if(this.upstreamUnsub){
				this.upstreamUnsub()
				this.upstreamUnsub = null
			}
			this.value = noValue
		}
	}

	private trySubToParent(this: ValueBoxWithUpstream<T> & WBox<T>): void {
		if(!this.haveSubscribers()){
			this.value = this.getBoxValue()
			this.upstreamUnsub = this.upstream.subscribeWithDirection(this.getDownstreamDirection(), v => {
				const ourValue = this.getValueFromUpstream(v)
				this.tryChangeValue(ourValue, this.getUpstreamDirection(), this.upstream, this.propKey)
			}, this, this.propKey)
		}
	}

	override subscribeWithDirection(this: ValueBoxWithUpstream<T> & WBox<T>, direction: BoxDataFlowDirection, handler: SubscriberHandlerFn<T>, box?: RBox<unknown>, propKey?: PropKey): UnsubscribeFn {
		this.trySubToParent()
		const unsub = super.subscribeWithDirection(direction, handler, box!, propKey)
		return () => {
			unsub()
			this.tryUnsubFromParent()
		}
	}

	override notify(this: ValueBoxWithUpstream<T> & WBox<T>, value: T, from: BoxDataFlowDirection, box: RBox<unknown> | undefined, propKey: PropKey | undefined): void {
		// it's kinda out of place, but anyway
		// if this box have no subscribers - it should never store value
		// because it also don't subscribe to upstream in that case (because amount of subscriptions should be minimised)
		if(!this.haveSubscribers()){
			this.value = noValue
		}

		// this is also a little out of place
		// think of this block as a notification to parent that child value is changed
		// (although this is not conventional call to subscription)
		if(from !== this.getUpstreamDirection()){
			const upstreamObject = this.upstream()
			this.setValueIntoUpstream(upstreamObject, value)
			this.upstream.tryChangeValue(upstreamObject, this.getDownstreamDirection(), this, this.propKey)
		}

		super.notify(value, from, box, propKey)
	}

}

class PropValueBox<U, K extends keyof U> extends ValueBoxWithUpstream<U[K], U, K> {

	protected override getValueFromUpstream(upstreamObject: U): U[K] {
		return upstreamObject[this.propKey]
	}

	protected override setValueIntoUpstream(upstreamObject: U, value: U[K]): void {
		upstreamObject[this.propKey] = value
	}

	protected override getUpstreamDirection(): BoxDataFlowDirection {
		return BoxDataFlowDirection.parent
	}

	protected override getDownstreamDirection(): BoxDataFlowDirection {
		return BoxDataFlowDirection.child
	}

}

function makePropBox<P, K extends keyof P>(parent: ValueBox<P> & WBox<P>, key: K): WBox<P[K]> {

	function propertyValueBox(...args: [] | (P[K])[]): P[K] {
		if(args.length === 0){
			notificationStack.notifyOnAccess(result)
		} else {
			result.tryChangeValue(args[0]!, BoxDataFlowDirection.external)
		}

		return result.getBoxValue()
	}

	const result = addPrototypeToFunction(propertyValueBox, new PropValueBox(parent, key))

	return result
}

function makeValueBox<T>(value: T): ValueBox<T> & WBox<T> {

	function valueBox(...args: T[]): T {
		if(args.length < 1){
			notificationStack.notifyOnAccess(result)
		} else {
			result.tryChangeValue(args[0]!, BoxDataFlowDirection.external)
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


class ViewBox<T> extends BoxBase<T> implements RBoxFields<T> {

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
	(the only exception is when it knows for sure that cached value is fine, which it does by checking revisions)
	2. when we HAVE subscribers to view - value is stored, list of dependencies is stored
	view returns stored value when asked for value in this mode

	This way, you only need to remove all subscribers from view for it to be eligible to be GCed
	*/
	private depList = null as null | readonly RBox<unknown>[]
	private revList = null as null | number[]
	private subDisposers: UnsubscribeFn[] = []
	private onDependencyListUpdated = null as null | (() => void)

	constructor(
		private readonly computingFn: () => T,
		private readonly explicitDependencyList: readonly RBox<unknown>[] | undefined) {
		super(noValue)
	}

	subDispose(): void {
		this.subDisposers.forEach(x => x())
		this.subDisposers.length = 0
	}

	shouldRecalcValue(): boolean {
		if(this.value === noValue){
			return true // no value? let's recalculate
		}

		if(!this.depList || this.depList.length === 0){
			return true // no value, or no known dependenices - must recalculate
		}

		for(let i = 0; i < this.depList.length; i++){
			if(this.depList[i]!.revision !== this.revList![i]){
				return true
			}
		}

		return false // no need to recalc value, no dependencies changed
	}

	recalcValueWithoutSetting(): T {
		let newValue: T
		if(!this.explicitDependencyList){
			const boxesAccessed = new Set<RBox<unknown>>()
			newValue = notificationStack.withAccessNotifications(this.computingFn, box => boxesAccessed.add(box))
			this.depList = [...boxesAccessed]
		} else {
			newValue = notificationStack.withAccessNotifications(this.computingFn, null)
			this.depList = this.explicitDependencyList
		}

		const depList = this.depList
		const revList = this.revList ||= new Array(this.depList.length)
		for(let i = 0; i < depList.length; i++){
			revList[i] = depList[i]!.revision
		}

		return newValue
	}

	recalcValueAndResubscribe(canSkipCalc: boolean): T {
		this.subDispose()

		const shouldCalc = !canSkipCalc || this.shouldRecalcValue()
		const newValue = shouldCalc ? this.recalcValueWithoutSetting() : this.value as T

		const depList = this.depList!
		if(depList.length > 0){
			const doOnDependencyUpdated = this.onDependencyListUpdated ||= () => this.recalcValueAndResubscribe(false)
			for(let i = 0; i < depList.length; i++){
				this.subDisposers.push(depList[i]!.subscribe(doOnDependencyUpdated))
			}
		}

		if(shouldCalc){
			// always external here because viewBoxes don't really participate in box graph
			// box graph is required to prevent update loops through defining data flow directions
			// viewBox always have the same dataflow direction; you can't possibly flow data "upstream" of the viewBox
			// therefore it's safe to use external here
			this.tryChangeValue(newValue, BoxDataFlowDirection.external)
		}

		return newValue
	}

	override subscribeWithDirection(direction: BoxDataFlowDirection, handler: SubscriberHandlerFn<T>, box?: RBox<unknown> | undefined, propKey?: PropKey): UnsubscribeFn {
		if(!this.haveSubscribers()){
			this.recalcValueAndResubscribe(true)
		}
		const disposer = super.subscribeWithDirection(direction, handler, box!, propKey)
		return () => {
			disposer()
			if(!this.haveSubscribers()){
				this.subDispose()
			}
		}
	}

}

function makeViewBox<T>(computingFn: () => T, explicitDependencyList?: readonly RBox<unknown>[]): ViewBox<T> & RBox<T> {
	function viewBox(): T {
		notificationStack.notifyOnAccess(result)

		if(!result.shouldRecalcValue()){
			return result.value as T
		}

		if(result.haveSubscribers()){
			return result.recalcValueAndResubscribe(false)
		}

		const value = result.recalcValueWithoutSetting()
		result.tryChangeValue(value, BoxDataFlowDirection.external)
		return value
	}

	const result = addPrototypeToFunction(viewBox, new ViewBox(computingFn, explicitDependencyList))
	return result
}
