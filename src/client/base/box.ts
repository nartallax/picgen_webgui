import {addPrototypeToFunction} from "client/base/add_prototype_to_function"

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

	/* Those methods are similar to wbox's ones, just those produce readonly boxes */
	prop<K extends keyof T & (string | symbol)>(propKey: K): RBox<T[K]>
	prop<K extends keyof T & number>(propKey: K): RBox<T[K] | undefined>
	wrapElements<E, K>(this: WBox<E[]>, getKey: (element: E) => K): RBox<RBox<E>[]>
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

	/** If this box contains array, make a rbox that contains each element of this array wrapped in box
	 *
	 * Elements are bound to the values, not to the indices, so if the array is reordered - same values will stay in the same boxes
	 * Similarity of values is checked by keys. Key is what @param getKey returns.
	 * The only constraint on what key should be is it should be unique across the array. And it is compared by value.
	 * So you can have object-keys, they just must be the same objects every time, otherwise it won't work well.
	 * If original array is shrinked, excess boxes are detached from it and will always throw on read/write of the value,
	 * even if array grows again with values having same keys.
	 *
	 * Can behave weirdly/inconsistently if there are no subscribers to this box or children boxes. */
	wrapElements<E, K>(this: WBox<E[]>, getKey: (element: E) => K): RBox<WBox<E>[]>

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

type AnyBoxImpl<T> = ViewBox<T> | ValueBox<T>

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

/** Stack of boxes that are currently computing their value
 * Each box that can possibly want to call other boxes should put an item on top of the stack
 * That way, proper dependency graph can be built */
class BoxNotificationStack {
	private notificationStack: (Set<AnyBoxImpl<unknown>> | null)[] = []
	withAccessNotifications<R>(action: () => R, onAccess: Set<AnyBoxImpl<unknown>> | null): R {
		this.notificationStack.push(onAccess)
		let result: R
		try {
			result = action()
		} finally {
			this.notificationStack.pop()
		}
		return result
	}

	notifyOnAccess<T>(v: AnyBoxImpl<T>): void {
		const stackTop = this.notificationStack[this.notificationStack.length - 1]
		if(stackTop){
			stackTop.add(v as AnyBoxImpl<unknown>)
		}
	}
}


const notificationStack = new BoxNotificationStack()

/** Base for every Box */
abstract class BoxBase<T> {

	/** Revision is incremented each time value changes
	 *
	 * This value must never be visible outside of this box.
	 * It can only be used to prevent repeated calls of subscribers.
	 *
	 * It is very tempting to use revision number to check if value is changed or not
	 * However, it can go wrong when value does not change until you explicitly check
	 * For example, consider viewBox that depends on viewBox
	 * When there is no subscribers, first viewBox will never change, regardless of its sources
	 * And if you're only relying on revision number to check if it is changed, you'll be wrong */
	private revision = 1

	/** Internal subscribers are subscribers that make up a graph of boxes */
	private internalSubscribers = new Set<InternalSubscriber<T>>()
	/** External subscribers are subscribers that receive data outside of boxes graph */
	private externalSubscribers = new Set<ExternalSubscriber<T>>()

	constructor(public value: T | NoValue) {}

	haveSubscribers(): boolean {
		return this.internalSubscribers.size > 0 || this.externalSubscribers.size > 0
	}

	/** After box is disposed, it should not be used anymore
	 * This is reserved for very special cases and cannot really be used on any kind of box */
	dispose(): void {
		this.value = noValue
		for(const sub of this.internalSubscribers){
			sub.box.dispose()
		}
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
			return () => {
				this.externalSubscribers.delete(sub)
			}
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

	wrapElements<E, K>(this: ViewBox<E[]> | ValueBox<E[]>, getKey: (element: E) => K): ViewBox<ValueBox<E>[]> {
		return makeViewBoxByClassInstance<ValueBox<E>[], ArrayValueWrapViewBox<E, K>>(new ArrayValueWrapViewBox(this, getKey))
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
abstract class ValueBoxWithUpstream<T, U = unknown, B extends ValueBox<U> = ValueBox<U>> extends ValueBox<T> {

	private upstreamUnsub: UnsubscribeFn | null = null
	constructor(readonly upstream: B, value: T | NoValue) {
		super(value)
	}

	protected abstract extractValueFromUpstream(upstreamObject: U): T
	protected abstract buildUpstreamValue(value: T): U

	protected fetchValueFromUpstream(): T {
		return this.extractValueFromUpstream(this.getUpstreamValue())
	}

	protected shouldBeSubscribed(): boolean {
		return this.haveSubscribers()
	}

	protected doOnUpstreamChange(upstreamValue: U): void {
		const ourValue = this.extractValueFromUpstream(upstreamValue)
		this.tryChangeValue(ourValue, this.upstream)
	}

	protected notifyUpstreamOnChange(value: T): void {
		const upstreamObject = this.buildUpstreamValue(value)
		this.upstream.tryChangeValue(upstreamObject, this)
	}

	protected getUpstreamValue(): U {
		// if we are called from view calc function - we should prevent view to access our upstream box
		// so view will only subscribe to this box, but not to the parent
		return notificationStack.withAccessNotifications(this.upstream, null)
	}

	getBoxValue(): T {
		// just checking if we have value before returning it is not enough
		// sometimes when we have value we can be not subscribed
		// that means that our value can be outdated and we need to fetch new one regardless
		if(this.value !== noValue && this.upstreamUnsub !== null){
			return this.value as T
		} else {
			return this.fetchValueFromUpstream()
		}
	}

	tryUpdateUpstreamSub(): void {
		const shouldBeSub = this.shouldBeSubscribed()
		if(shouldBeSub && !this.upstreamUnsub){
			this.subToUpstream()
		} else if(!shouldBeSub && this.upstreamUnsub){
			this.unsubFromUpstream()
		}
	}

	private unsubFromUpstream() {
		if(!this.upstreamUnsub){
			throw new Error("Assertion failed")
		}
		this.upstreamUnsub()
		this.upstreamUnsub = null
		this.value = this.getEmptyValue()
	}

	private subToUpstream(): void {
		if(this.upstreamUnsub){
			throw new Error("Assertion failed")
		}
		if(this.value === noValue){
			this.value = this.getBoxValue()
		}
		this.upstreamUnsub = this.upstream.doSubscribe(false, this.doOnUpstreamChange.bind(this), this)
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
			this.value = this.getEmptyValue()
		}

		// this is also a little out of place
		// think of this block as a notification to parent that child value is changed
		// (although this is not conventional call to subscription)
		if(box as unknown !== this.upstream){
			this.notifyUpstreamOnChange(value)
		}

		super.notify(value, box)
	}

	protected getEmptyValue(): T | NoValue {
		return noValue
	}

}

abstract class FixedPropValueBox<U, K extends keyof U> extends ValueBoxWithUpstream<U[K], U> {

	constructor(upstream: ValueBox<U>, protected readonly propKey: K) {
		super(upstream, noValue)
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

// FIXME: delete this, it won't work well anyway
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

function makeUpstreamBox<T, U, B>(instance: ValueBoxWithUpstream<T, U> & B): ValueBoxWithUpstream<T, U> & B {

	function upstreamValueBox(...args: T[]): T {
		if(args.length === 0){
			notificationStack.notifyOnAccess(result)
		} else {
			result.tryChangeValue(args[0]!)
		}

		return result.getBoxValue()
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


abstract class ViewBox<T> extends (BoxBase as {
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

	private boundCalcVal: (() => T) | null = null
	protected abstract calculateValue(): T

	constructor(private readonly explicitDependencyList: readonly RBox<unknown>[] | undefined) {
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

	private recalcValueAndResubscribe(forceSubscribe: boolean): void {
		// we preserve list of our old subscriptions to drop them only at the end of the method
		// we do that because some box implementations can change its internal state dramatically when they have 0 subs
		// and to prevent them going back and forth, we first create new subscribers, and only then let go old ones
		const oldSubDisposers = [...this.subDisposers]

		let newValue: T
		let depList: readonly AnyBoxImpl<unknown>[]
		const calc = this.boundCalcVal ||= this.calculateValue.bind(this)
		if(!this.explicitDependencyList){
			const boxesAccessed = new Set<AnyBoxImpl<unknown>>()
			newValue = notificationStack.withAccessNotifications(calc, boxesAccessed)
			depList = [...boxesAccessed]
		} else {
			newValue = notificationStack.withAccessNotifications(calc, null)
			depList = this.explicitDependencyList as AnyBoxImpl<unknown>[]
		}

		// we can safely not pass a box here
		// because box is only used to prevent notifications to go back to original box
		// and we should never be subscribed to itself, because it's not really possible
		this.tryChangeValue(newValue)

		// this check is here because as a result of recalculation we may lose all of our subscribers
		// and therefore we don't need to be subscribed to anything anymore
		// (that's the case with array wrap)
		if(forceSubscribe || this.haveSubscribers()){
			if(depList.length > 0){
				const doOnDependencyUpdated = this.onDependencyListUpdated ||= () => this.recalcValueAndResubscribe(false)
				for(let i = 0; i < depList.length; i++){
					this.subDisposers.push(depList[i]!.doSubscribe(false, doOnDependencyUpdated, this))
				}
			}
		} else {
			this.value = noValue
		}
		for(const subDisposer of oldSubDisposers){
			subDisposer()
		}
		// ew. maybe there is some more efficient structure for that...?
		this.subDisposers = this.subDisposers.slice(oldSubDisposers.length)
	}

	override doSubscribe<B>(external: boolean, handler: SubscriberHandlerFn<T>, box?: RBoxBase<B> | undefined): UnsubscribeFn {
		if(!this.haveSubscribers()){
			// because we must have a value before doSubscribe can be called
			// and also we will have a sub right now, might as well prepare for that
			this.recalcValueAndResubscribe(true)
		}
		const unsub = super.doSubscribe(external, handler, box)
		return () => {
			unsub()
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

		const calc = this.boundCalcVal ||= this.calculateValue.bind(this)
		return notificationStack.withAccessNotifications(calc, null)
	}

	prop<K extends keyof T>(propKey: K): RBox<T[K]> {
		return this.map(v => v[propKey])
	}

}

class ComputingFnViewBox<T> extends ViewBox<T> {

	constructor(protected readonly calculateValue: () => T, explicitDependencyList: readonly RBox<unknown>[] | undefined) {
		super(explicitDependencyList)
	}

}

function makeViewBox<T>(computingFn: () => T, explicitDependencyList?: readonly RBox<unknown>[]): ViewBox<T> {
	return makeViewBoxByClassInstance<T, ViewBox<T>>(new ComputingFnViewBox(computingFn, explicitDependencyList))
}

function makeViewBoxByClassInstance<T, B extends ViewBox<T>>(instance: B): B {
	function viewBox(): T {
		return result.getValue()
	}

	const result = addPrototypeToFunction(viewBox, instance)
	return result
}

// TODO: test:
// upstream has value, take a wrap-array, take a box
// update value in upstream array once, with the same keys, but different values
// update value in upstream array second time, with different keys
// between the updates check/not check value of the element wrap box
// check what is in the box after both of updates

// TODO: test
// upstream has value, take a wrap-array, take a box
// update upstream, adding value at the start
// check the value in the box
class ArrayValueWrapViewBox<T, K> extends ViewBox<ValueBox<T>[]> {

	private readonly childMap = new Map<K, ArrayElementValueBox<T, K>>()

	constructor(readonly upstream: ViewBox<T[]> | ValueBox<T[]>, private readonly getKey: (value: T) => K) {
		super([upstream])
	}

	// TODO: test for two subscriptions: first array wrap subscribes to upstream, then view subscribes to upstream
	// and then maybe updates to upstream will fuckup something, or updates to element
	// and vice-versa
	protected override calculateValue(): ValueBox<T>[] {
		const outdatedKeys = new Set(this.childMap.keys())

		const upstreamArray = notificationStack.withAccessNotifications(this.upstream, null)
		if(!Array.isArray(upstreamArray)){
			throw new Error("Assertion failed: upstream value is not array for array-wrap box")
		}
		const result = upstreamArray.map(item => {
			const key = this.getKey(item)
			let box = this.childMap.get(key)
			if(box){
				if(!outdatedKeys.has(key)){
					throw new Error("Constraint violated, key is not unique: " + key)
				}
				box.tryChangeValue(item, this)
			} else {
				box = makeUpstreamBox(new ArrayElementValueBox(key, item, this))
				this.childMap.set(key, box)
			}

			outdatedKeys.delete(key)

			return box
		})

		for(const key of outdatedKeys){
			const box = this.childMap.get(key)!
			box.dispose()
			this.childMap.delete(key)
		}

		return result
	}

	tryUpdateChildrenValues(): void {
		this.calculateValue()
	}

	notifyValueChanged(value: T, box: ArrayElementValueBox<T, K>): void {
		if(!isWBox(this.upstream)){
			// should be prevented by typechecker anyway
			throw new Error("You cannot change the value of upstream array in readonly box through wrap-box")
		}

		const key = this.getKey(value)
		const existingBox = this.childMap.get(key)
		const oldBoxKey = box.key
		if(!existingBox){
			this.childMap.delete(box.key)
			this.childMap.set(key, box)
			box.key = key
		} else if(existingBox !== box){
			throw new Error("Constraint violated, key is not unique: " + key)
		}

		// Q: why do we search for key here?
		// A: see explaination in element wrap impl
		// (in short, index could change between updates, that's why we don't rely on them)
		// FIXME: bring back index and use it when we are subscribed, because then it is guaranteed to be consistent with the upstream
		let upstreamValue = notificationStack.withAccessNotifications(this.upstream, null)
		upstreamValue = [...upstreamValue]
		let index = -1
		for(let i = 0; i < upstreamValue.length; i++){
			const item = upstreamValue[i]!
			const itemKey = this.getKey(item)
			if(itemKey === oldBoxKey){
				// we can just break on the first found key, I'm just all about assertions
				// btw maybe this assertion will break some of legitimate use cases..?
				if(index >= 0){
					throw new Error("Constraint violated, key is not unique: " + oldBoxKey)
				}
				index = i
			}
		}

		if(index < 0){
			// value with old key is not found
			// that means the box was detached before it received an update
			box.dispose()
			box.throwDetachedError()
		}

		upstreamValue[index] = value
		this.upstream.tryChangeValue(upstreamValue, this)
	}

}

class ArrayElementValueBox<T, K> extends ValueBoxWithUpstream<T, ValueBox<T>[], ArrayValueWrapViewBox<T, K>> {

	private disposed = false

	constructor(public key: K, value: T, upstream: ArrayValueWrapViewBox<T, K>) {
		super(upstream, value)
	}

	override dispose(): void {
		this.disposed = true
		// update of sub may or may not set empty value (if there is no sub)
		// let's set it explicitly
		this.value = noValue
		this.tryUpdateUpstreamSub()
		super.dispose()
	}

	protected override shouldBeSubscribed(): boolean {
		// TODO: test unsub on dispose
		return !this.disposed && super.shouldBeSubscribed()
	}

	protected override fetchValueFromUpstream(): T {
		// this is bad, but I don't see a better solution
		// thing is, when you're not subscribed - you have absolutely zero guarantees that upstream did not change
		// (and you can't be always subscribed because it will create memory leak)
		// this has two consequences:
		// 1. you can't rely that `index` stays the same
		// (so you cannot just grab upstream, take value on the index and expect it to be the value you're after)
		// 2. you can't rely that your value is still in the array at all
		// (so you may become detached at arbitrary moment, possibly with outdated value)
		// we combat those two consequences with following countermeasures:
		// 1. when we need to get the value, we ALWAYS receive value from wrapper box. no exceptions.
		// alternative to that will be grabbing upstream array, iterating over each item and checking for key equality
		// but this will be terrible for performance
		// 2. we forbid accessing detached values at all
		// this is bad because two things: it can unexpectedly break, and it is inconsistent
		// I mean, who knows when exactly value disappeared from upstream array if we was not subscribed to it?
		// noone knows! and by that reason box may become detached (if update happened during absence of value),
		// or not (if it did not happen, or happened after value with the same key appears in array again)
		// what can go wrong, usage-wise?
		// well, if user stores element wrapper boxes - he should be prepared that sometimes they can throw
		this.checkNotDisposed()
		this.upstream.tryUpdateChildrenValues()
		this.checkNotDisposed() // second check, we may become disposed after update
		return this.value as T
	}

	private checkNotDisposed(): void {
		if(this.disposed){
			this.throwDetachedError()
		}
	}

	throwDetachedError(): void {
		throw new Error("Element wrap box for key " + anythingToString(this.key) + " is no longer attached to an upstream box, because upstream box does not have this key, or did not have this key in some time in the past after this box was created.")
	}

	protected override extractValueFromUpstream(): T {
		throw new Error("This method should never be called on this box")
	}

	protected override buildUpstreamValue(): ValueBox<T>[] {
		throw new Error("This method should never be called on this box")
	}

	protected override doOnUpstreamChange(): void {
		// nothing. upstream will put value into this box by itself
		// element box must never subscribe to upstream-of-upstream array-box directly, or pull values by itself
		// this way its index can sometimes be outdated and he can pull wrong value from upstream
		// instead, element box must force parent view to subscribe to upstream
		// so parent view can handle down proper index and value at the same time
		// so, we still subscribe to upstream, just so it is subscribed to upstream-of-upstream and deliver updates
	}

	protected notifyUpstreamOnChange(value: T): void {
		this.checkNotDisposed()
		this.upstream.notifyValueChanged(value, this)
	}

	protected override getEmptyValue(): NoValue | T {
		return this.disposed ? noValue : this.value
	}

}

function anythingToString(x: unknown): string {
	if(typeof(x) === "symbol"){
		return x.toString()
	} else {
		return x + ""
	}
}