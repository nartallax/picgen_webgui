type Subscriber<T> = (value: T) => void
type Unsubscribe = () => void
type Writable<T> = {-readonly[k in keyof T]: T[k]}

/** Readonly part of the WBox */
export interface RBox<T>{
	(): T
	subscribe(subscriber: Subscriber<T>): Unsubscribe
	notify(): void
	readonly isRBox: true
	/** Each time stored value changes, revision is incremented
	 * Can be used to track if value is changed or not without actually storing value */
	readonly revision: number
}

const defaultStartingRevision = 1

export type RBoxOrValue<T> = T | RBox<T>
export type MaybeRBoxed<T> = [T] extends [RBox<unknown>] ? T : T | RBox<T>

export function isRBox<T>(x: RBoxOrValue<T>): x is RBox<T> {
	return typeof(x) === "function" && (!!(x as RBox<T>).isRBox)
}

export function unbox<T>(x: RBoxOrValue<T>): T {
	return isRBox(x) ? x() : x
}

/** Writable box. Something that can hold value and notify subscribers about changes in the value. */
export interface WBox<T> extends RBox<T>{
	(newValue: T): T
	readonly isWBox: true
	prop<K extends keyof T & (string | symbol)>(propKey: K): WBox<T[K]>
	prop<K extends keyof T & number>(propKey: K): WBox<T[K] | undefined>
}

// any WBox<T> is also InternalWBox<T>
// you just should not use any properties of internal one from outside the box framework
interface InternalWBox<T> extends WBox<T>{
	subscribeForField: WBox<T>["subscribe"]
	updateByField(newValue: T): void
}


export type WBoxOrValue<T> = T | WBox<T>

export function isWBox<T>(x: WBox<T>): x is WBox<T> {
	return typeof(x) === "function" && (!!(x as WBox<T>).isWBox)
}

type BoxSubscriber<T = unknown> = (box: RBox<T>) => void

interface SubscribeNotify<T>{
	// TODO: more sophisticated data structure here for performance? keep in mind notify() call specifics
	subscribers: Set<SubscriberInternal<T>>
	subscribe(listener: Subscriber<T>): Unsubscribe
	subscribeForField(listener: Subscriber<T>): Unsubscribe
	notify(): void
	notifyByField(): void
}

interface SubscriberInternal<T>{
	fn(value: T): void
	/* Last value that was passed to the subscriber.
	Sometimes trick with revisions is not enough to properly cull subscriber calls
	because on next revision, before subscriber is called, value could have changed back and forth */
	lastKnownValue: T
	lastKnownRevision: number
	readonly isFieldSub: boolean
}

function createSubscribeNotify<T>(getValue: () => T, getRevision: () => number): SubscribeNotify<T> {
	const subscribers = new Set<SubscriberInternal<T>>()

	function subscribe(listener: Subscriber<T>, isFieldSub: boolean): Unsubscribe {
		const sub: SubscriberInternal<T> = {
			fn: listener,
			lastKnownValue: getValue(),
			lastKnownRevision: getRevision(),
			isFieldSub
		}
		subscribers.add(sub)
		return () => subscribers.delete(sub)
	}

	let lastNotifyWithFieldsSubsRevision = defaultStartingRevision
	function notify(includeFieldSubs: boolean): void {
		const startingRevision = getRevision()
		if(includeFieldSubs){
			lastNotifyWithFieldsSubsRevision = startingRevision
		}
		const subs = [...subscribers]
		const value = getValue()
		for(const sub of subs){
			if(!boxContentCanBeDifferent(sub.lastKnownValue, value)){
				continue
			}
			if(!includeFieldSubs && sub.isFieldSub){
				continue
			}
			if(sub.lastKnownRevision > startingRevision){
				continue
			}
			sub.lastKnownRevision = startingRevision
			sub.lastKnownValue = value
			sub.fn(value)

			if(startingRevision !== lastNotifyWithFieldsSubsRevision){
				// after we invoke subscriber, that subscriber can put a new value in the box
				// if that happened, we need to stop invoke subscribers
				// because there already was another round of notify() with most recent value
				// and there is absolutely no reason to continue this round of notify()
				// (but we can early-exit only if one of the following rounds of notify() actually included all the subs)
				// (because otherwise field-subs can sometimes not get the update)
				break
			}
		}
	}

	// TODO: maybe all this can be a class? or at least a prototype that is assigned to function on creation?
	// I don't know. Maybe it will be more performant and less memory-hungry, maybe not
	const subNot: SubscribeNotify<T> = {
		subscribers,
		subscribeForField: function subscribeForField(listener: Subscriber<T>) {
			return subscribe(listener, true)
		},
		subscribe: function subscribeForGeneralPurpose(listener: Subscriber<T>) {
			return subscribe(listener, false)
		},
		notify: function notifyByGeneralUpdate() {
			notify(true)
		},
		notifyByField: function notifyByfield() {
			notify(false)
		}
	}

	return subNot
}

const notificationStack: (BoxSubscriber | null)[] = []
function withAccessNotifications<T>(action: () => T, onAccess: BoxSubscriber): T {
	notificationStack.push(onAccess)
	let result: T
	try {
		result = action()
	} finally {
		notificationStack.pop()
	}
	return result
}

function notifyOnAccess(v: RBox<unknown>): void {
	const stackTop = notificationStack[notificationStack.length - 1]
	if(stackTop){
		stackTop(v)
	}
}

function boxContentCanBeDifferent<T>(oldValue: T, newValue: T): boolean {
	// we check non-null objects separately
	// because even if reference did not change, some fields could
	return newValue !== oldValue || (typeof(oldValue) === "object" && oldValue !== null)
}

/** Make a plain simple WBox */
export function box<T>(x: T): WBox<T> {
	let value: T = x

	function updateWBoxValue(newValue: T, byField: boolean) {
		if(boxContentCanBeDifferent(value, newValue)){
			(result as Writable<WBox<T>>).revision++
			value = newValue
			if(byField){
				notifyByField()
			} else {
				notify()
			}
		}
	}

	const fn = function wbox(...args: [] | [T]): T {
		if(args.length < 1){
			notifyOnAccess(result)
		} else {
			updateWBoxValue(args[0]!, false)
		}

		return value
	}

	const {subscribe, notify, notifyByField, subscribeForField} = createSubscribeNotify(() => value, () => result.revision)
	const result: InternalWBox<T> = Object.assign(fn, {
		isRBox: true as const,
		isWBox: true as const,
		subscribe, notify,
		revision: defaultStartingRevision,
		prop: makePropertySubBox,
		subscribeForField,
		updateByField: function updateByField(newValue: T): void {
			updateWBoxValue(newValue, true)
		}
	})

	return result
}

/** Make a RBox that computes its value from other boxes */
export function viewBox<T>(computingFn: () => T): RBox<T> {
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

	let hasComputedValue = false
	let value: T | null = null
	const subDisposers: Unsubscribe[] = []
	const subDispose = () => {
		subDisposers.forEach(x => x())
		subDisposers.length = 0
	}

	const computeAndSubscribe = () => {
		subDispose()

		const boxesAccessed = new Set<RBox<unknown>>()
		const newValue = withAccessNotifications(computingFn, box => boxesAccessed.add(box))

		boxesAccessed.forEach(v => subDisposers.push(v.subscribe(computeAndSubscribe)))

		const valueChanged = !hasComputedValue || boxContentCanBeDifferent(value, newValue)
		hasComputedValue = true
		value = newValue
		if(valueChanged){
			(result as Writable<RBox<T>>).revision++
			result.notify()
		}

		return value
	}

	const maybeUnsubscribeFromValues = () => {
		if(subscribers.size === 0){
			hasComputedValue = false
			value = null
			subDispose()
		}
	}

	const fn = function viewBox(): T {
		notifyOnAccess(result)
		if(!hasComputedValue){
			if(subscribers.size === 0){
				return computingFn()
			}
			return computeAndSubscribe()
		}
		return value as T
	}

	const {subscribe, notify, subscribers} = createSubscribeNotify(fn, () => result.revision)
	const wrappedSubscribe = (listener: Subscriber<T>) => {
		if(!hasComputedValue){
			computeAndSubscribe()
		}
		const disposer = subscribe(listener)
		return () => {
			disposer()
			maybeUnsubscribeFromValues()
		}
	}

	const result: RBox<T> = Object.assign(fn, {
		isRBox: true as const,
		subscribe: wrappedSubscribe,
		notify,
		revision: defaultStartingRevision
	})

	return result
}

function makePropertySubBox<T, K extends keyof T>(this: InternalWBox<T>, propKey: K): WBox<T[K]> {
	let hasValue = false
	let value = null as T[K] | null
	let parentUnsub = null as Unsubscribe | null
	// eslint-disable-next-line @typescript-eslint/no-this-alias
	const parent = this

	function getPropWBoxValue(): T[K] {
		if(hasValue){
			return value!
		} else {
			try {
				// if we are called from view - we should prevent view to access our parent box
				// so view will only subscribe to this box, but not to the parent
				notificationStack.push(null)
				return parent()[propKey]
			} finally {
				notificationStack.pop()
			}
		}
	}

	const {subscribe, notify, subscribeForField, notifyByField, subscribers} = createSubscribeNotify(getPropWBoxValue, () => result.revision)

	function updatePropertySubWBox(newValue: T[K], byField: boolean, skipParentUpdate: boolean) {
		if(boxContentCanBeDifferent(value, newValue)){
			if(hasValue){
				value = newValue;
				(result as Writable<WBox<T[K]>>).revision++
			}
			if(!skipParentUpdate){
				const parentObject = parent()
				parentObject[propKey] = newValue
				parent.updateByField(parentObject)
			}
			if(byField){
				notifyByField()
			} else {
				notify()
			}
		}
	}

	function propertySubWBox(...args: [] | (T[K])[]): T[K] {
		if(args.length === 0){
			notifyOnAccess(result)
		} else {
			updatePropertySubWBox(args[0]!, false, false)
		}

		return getPropWBoxValue()
	}

	function tryUnsubFromParent() {
		if(subscribers.size === 0){
			hasValue = false
			value = null
			if(parentUnsub){
				parentUnsub()
			}
		}
	}

	function trySubToParent(): void {
		if(subscribers.size === 0){
			value = getPropWBoxValue()
			hasValue = true
			parentUnsub = parent.subscribeForField(v => {
				updatePropertySubWBox(v[propKey], false, true)
			})
		}
	}

	function propertySubWBoxSubscribe(listener: Subscriber<T[K]>, forField: boolean): Unsubscribe {
		trySubToParent()
		const unsub = (forField ? subscribeForField : subscribe)(listener)
		return () => {
			unsub()
			tryUnsubFromParent()
		}
	}

	const result: InternalWBox<T[K]> = Object.assign(propertySubWBox, {
		isRBox: true as const,
		isWBox: true as const,
		subscribe: (listener: Subscriber<T[K]>) => propertySubWBoxSubscribe(listener, false),
		notify,
		revision: defaultStartingRevision,
		prop: makePropertySubBox,
		subscribeForField: (listener: Subscriber<T[K]>) => propertySubWBoxSubscribe(listener, true),
		updateByField: function updatePropWBoxByField(value: T[K]): void {
			updatePropertySubWBox(value, true, false)
		}
	})

	return result
}