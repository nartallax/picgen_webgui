import {viewBox, box, RBox, WBox} from "client/base/box"
import {assertEquals, assertThrows, makeTestPack} from "test/test_utils"

interface RBoxInternal<T> extends RBox<T> {
	haveSubscribers(): boolean
}

type WBoxInternal<T> = WBox<T> & RBoxInternal<T>

export default makeTestPack("box", makeTest => {

	makeTest("wbox simple test", () => {
		const b = box(0)
		b(5)

		assertEquals(b(), 5)

		let subscriberCalledTimes = 0
		const unsub = b.subscribe(() => subscriberCalledTimes++)
		assertEquals(subscriberCalledTimes, 0)

		b(10)
		assertEquals(subscriberCalledTimes, 1)
		b(10)
		assertEquals(subscriberCalledTimes, 1)
		b(15)
		assertEquals(subscriberCalledTimes, 2)
		unsub()
		b(7)
		assertEquals(subscriberCalledTimes, 2)
	})

	makeTest("viewBox simple test", () => {
		const a = box(0)
		const b = viewBox(() => Math.floor(a() / 2))

		let calls = 0
		const unsub = b.subscribe(() => calls++)
		assertEquals(calls, 0)
		assertEquals(b(), 0)

		a(1)
		assertEquals(b(), 0)
		assertEquals(calls, 0)

		a(2)
		assertEquals(b(), 1)
		assertEquals(calls, 1)

		unsub()
		a(5)
		assertEquals(b(), 2)
		assertEquals(calls, 1)
	})

	makeTest("chain subscription test", () => {
		const a = box(5)
		const b = viewBox(() => a() * 2)
		const c = viewBox(() => b() * 3)

		let successB = false
		let successC = false

		b()
		const disposeB = b.subscribe(() => {
			successB = true
		})

		c()
		const disposeC = c.subscribe(() => {
			successC = true
		})
		a(10)

		assertEquals(a(), 10)
		assertEquals(b(), 20)
		assertEquals(c(), 60)
		assertEquals(successB, true)
		assertEquals(successC, true)

		disposeB()
		disposeC()
	})

	makeTest("same-value notification culling", () => {
		const b = box<unknown>({a: 5})
		let calls = 0
		b.subscribe(() => calls++)
		b({a: 10})
		assertEquals(calls, 1)
		b(b())
		assertEquals(calls, 1)
		b(null)
		assertEquals(calls, 2)
		b(null)
		assertEquals(calls, 2)

		const obj = {b: 5}
		b(obj)
		assertEquals(calls, 3)
		b(obj)
		assertEquals(calls, 3)
		b(5)
		assertEquals(calls, 4)
		b(5)
		assertEquals(calls, 4)
	})

	makeTest("view only subscribes to direct dependencies", () => {
		const a = box(5)
		let bRecalcs = 0
		const b = viewBox(() => {
			bRecalcs++
			return Math.floor(a() / 2)
		})
		let cRecalcs = 0
		const c = viewBox(() => {
			cRecalcs++
			return b() + 1
		})

		let bCalls = 0
		b.subscribe(() => bCalls++)
		let cCalls = 0
		c.subscribe(() => cCalls++)
		assertEquals(b(), 2)
		assertEquals(c(), 3)
		assertEquals(bRecalcs, 1)
		assertEquals(cRecalcs, 1)

		a(6)
		assertEquals(bCalls, 1)
		assertEquals(cCalls, 1)
		assertEquals(b(), 3)
		assertEquals(c(), 4)
		assertEquals(bRecalcs, 2)
		assertEquals(cRecalcs, 2)

		a(7)
		assertEquals(bCalls, 1)
		assertEquals(cCalls, 1)
		assertEquals(b(), 3)
		assertEquals(c(), 4)
		// THIS what this test is all about
		// b recalculated, but c does not
		// because c is only subscribed to b, and b did not change
		assertEquals(bRecalcs, 3)
		assertEquals(cRecalcs, 2)
	})

	makeTest("subscriber does not receive outdated values", () => {
		const b = box(0)
		b.subscribe(v => b(Math.floor(v / 2) * 2))
		let lastVisibleValue = b()
		let callsCount = 0
		b.subscribe(v => {
			lastVisibleValue = v
			callsCount++
		})

		assertEquals(callsCount, 0)
		b(1)
		assertEquals(callsCount, 0)
		assertEquals(lastVisibleValue, 0)
		b(2)
		assertEquals(callsCount, 1)
		assertEquals(lastVisibleValue, 2)
		b(3)
		assertEquals(callsCount, 1)
		assertEquals(lastVisibleValue, 2)
		b(4)
		assertEquals(callsCount, 2)
		assertEquals(lastVisibleValue, 4)
	})

	makeTest("basic property subbox test", () => {
		const parent = box({a: 5})
		const child = parent.prop("a")

		assertEquals(child(), 5)
		child(6)
		assertEquals(child(), 6)
		assertEquals(parent().a, 6)

		let calls = 0
		let lastValue = child()
		child.subscribe(v => {
			lastValue = v
			calls++
		})
		assertEquals(lastValue, 6)
		assertEquals(calls, 0)

		child(7)
		assertEquals(lastValue, 7)
		assertEquals(calls, 1)

		parent({a: 8})
		assertEquals(lastValue, 8)
		assertEquals(calls, 2)
	})

	makeTest("property subbox array test", () => {
		const parent = box([1, 2, 3])
		const child = parent.prop(3)

		assertEquals(child(), undefined)
		child(4)
		assertEquals(parent().join(","), "1,2,3,4")
		assertEquals(child(), 4)

		let lastValue = child()
		child.subscribe(v => lastValue = v)
		parent([1, 2, 3, 7])
		assertEquals(child(), 7)
		assertEquals(lastValue, 7)
	})

	makeTest("property subbox properly ignores circular updates", () => {
		const parent = box({a: {c: 5}, b: {d: "uwu"}})
		const childA = parent.prop("a")
		const childB = parent.prop("b")

		let callsParent = 0
		parent.subscribe(() => callsParent++)
		let callsA = 0
		childA.subscribe(() => callsA++)
		let callsB = 0
		childB.subscribe(() => callsB++)
		assertEquals(callsA, 0)
		assertEquals(callsB, 0)

		childA({c: 10})
		assertEquals(callsParent, 1)
		assertEquals(callsA, 1)
		assertEquals(callsB, 0)

		childB({d: "owo"})
		assertEquals(callsParent, 2)
		assertEquals(callsA, 1)
		assertEquals(callsB, 1)

		parent({a: {c: 15}, b: {d: "x_x"}})
		assertEquals(callsParent, 3)
		assertEquals(callsA, 2)
		assertEquals(callsB, 2)
	})

	makeTest("chain property subboxes", () => {
		const parent = box({a: {b: {c: 5}}})
		const middle = parent.prop("a")
		const child = middle.prop("b")
		let parentCalls = 0
		const parentUnsub = parent.subscribe(() => parentCalls++)
		let childCalls = 0
		const childUnsub = child.subscribe(() => childCalls++)
		let middleCalls = 0
		const middleUnsub = middle.subscribe(() => middleCalls++)

		assertEquals(parentCalls, 0)
		assertEquals(childCalls, 0)
		assertEquals(parent().a.b.c, 5)
		assertEquals(child().c, 5)

		child({c: 10})
		assertEquals(parentCalls, 1)
		assertEquals(childCalls, 1)
		assertEquals(parent().a.b.c, 10)
		assertEquals(child().c, 10)

		parent({a: {b: {c: 15}}})
		assertEquals(parentCalls, 2)
		assertEquals(childCalls, 2)
		assertEquals(parent().a.b.c, 15)
		assertEquals(child().c, 15)

		middle({b: {c: 20}})
		assertEquals(parentCalls, 3)
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 20)
		assertEquals(child().c, 20)

		parentUnsub()
		childUnsub()
		middleUnsub()

		child({c: 10})
		assertEquals(parentCalls, 3)
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 10)
		assertEquals(child().c, 10)

		parent({a: {b: {c: 15}}})
		assertEquals(parentCalls, 3)
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 15)
		assertEquals(child().c, 15)

		middle({b: {c: 20}})
		assertEquals(parentCalls, 3)
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 20)
		assertEquals(child().c, 20)

	})

	makeTest("chain property subboxes with middle one implicit subscrption", () => {
		const parent = box({a: {b: {c: 5}}})
		const middle = parent.prop("a")
		const child = middle.prop("b")
		let parentCalls = 0
		const parentUnsub = parent.subscribe(() => parentCalls++)
		let childCalls = 0
		const childUnsub = child.subscribe(() => childCalls++)

		assertEquals(parentCalls, 0)
		assertEquals(childCalls, 0)
		assertEquals(parent().a.b.c, 5)
		assertEquals(child().c, 5)

		child({c: 10})
		assertEquals(parentCalls, 1)
		assertEquals(childCalls, 1)
		assertEquals(parent().a.b.c, 10)
		assertEquals(child().c, 10)

		parent({a: {b: {c: 15}}})
		assertEquals(parentCalls, 2)
		assertEquals(childCalls, 2)
		assertEquals(parent().a.b.c, 15)
		assertEquals(child().c, 15)

		middle({b: {c: 20}})
		assertEquals(parentCalls, 3)
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 20)
		assertEquals(child().c, 20)

		parentUnsub()
		childUnsub()

		child({c: 10})
		assertEquals(parentCalls, 3)
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 10)
		assertEquals(child().c, 10)

		parent({a: {b: {c: 15}}})
		assertEquals(parentCalls, 3)
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 15)
		assertEquals(child().c, 15)

		middle({b: {c: 20}})
		assertEquals(parentCalls, 3)
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 20)
		assertEquals(child().c, 20)
	})

	makeTest("chain property subboxes with only top sub", () => {
		const parent = box({a: {b: {c: 5}}})
		const middle = parent.prop("a")
		const child = middle.prop("b")
		let parentCalls = 0
		const unsub = parent.subscribe(() => parentCalls++)

		assertEquals(parentCalls, 0)
		assertEquals(parent().a.b.c, 5)
		assertEquals(child().c, 5)

		child({c: 10})
		assertEquals(parentCalls, 1)
		assertEquals(parent().a.b.c, 10)
		assertEquals(child().c, 10)

		parent({a: {b: {c: 15}}})
		assertEquals(parentCalls, 2)
		assertEquals(parent().a.b.c, 15)
		assertEquals(child().c, 15)

		middle({b: {c: 20}})
		assertEquals(parentCalls, 3)
		assertEquals(parent().a.b.c, 20)
		assertEquals(child().c, 20)

		unsub()

		child({c: 10})
		assertEquals(parentCalls, 3)
		assertEquals(parent().a.b.c, 10)
		assertEquals(child().c, 10)

		parent({a: {b: {c: 15}}})
		assertEquals(parentCalls, 3)
		assertEquals(parent().a.b.c, 15)
		assertEquals(child().c, 15)

		middle({b: {c: 20}})
		assertEquals(parentCalls, 3)
		assertEquals(parent().a.b.c, 20)
		assertEquals(child().c, 20)
	})

	makeTest("chain property subboxes with only bottom sub", () => {
		const parent = box({a: {b: {c: 5}}})
		const middle = parent.prop("a")
		const child = middle.prop("b")
		let childCalls = 0
		const unsub = child.subscribe(() => childCalls++)

		assertEquals(childCalls, 0)
		assertEquals(parent().a.b.c, 5)
		assertEquals(child().c, 5)

		child({c: 10})
		assertEquals(childCalls, 1)
		assertEquals(parent().a.b.c, 10)
		assertEquals(child().c, 10)

		parent({a: {b: {c: 15}}})
		assertEquals(childCalls, 2)
		assertEquals(parent().a.b.c, 15)
		assertEquals(child().c, 15)

		middle({b: {c: 20}})
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 20)
		assertEquals(child().c, 20)

		unsub()

		child({c: 10})
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 10)
		assertEquals(child().c, 10)

		parent({a: {b: {c: 15}}})
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 15)
		assertEquals(child().c, 15)

		middle({b: {c: 20}})
		assertEquals(childCalls, 3)
		assertEquals(parent().a.b.c, 20)
		assertEquals(child().c, 20)
	})

	makeTest("views calculations when noone is subscribed", () => {
		const b = box(5)
		let calcCount = 0
		const view = viewBox(() => {
			calcCount++
			return b() * 2
		})

		assertEquals(calcCount, 0)
		assertEquals(view(), 10)
		assertEquals(calcCount, 1)
		assertEquals(view(), 10)
		assertEquals(calcCount, 2)

		b(6)
		assertEquals(calcCount, 2)
		assertEquals(view(), 12)
		assertEquals(calcCount, 3)
		assertEquals(view(), 12)
		assertEquals(calcCount, 4)
	})

	makeTest("view only subscribes to param box, not to the parent box", () => {
		const parent = box({a: 5})
		const child = parent.prop("a")
		let parentNotifications = 0
		parent.subscribe(() => parentNotifications++)
		let childNotifications = 0
		child.subscribe(() => childNotifications++)
		let calcCount = 0
		const view = viewBox(() => {
			calcCount++
			return child() * 2
		})
		view.subscribe(() => {
			// nothing
		})

		assertEquals(calcCount, 1)
		assertEquals(parentNotifications, 0)
		assertEquals(childNotifications, 0)

		parent({a: 6})
		assertEquals(calcCount, 2)
		assertEquals(parentNotifications, 1)
		assertEquals(childNotifications, 1)

		parent({a: 6})
		assertEquals(calcCount, 2)
		assertEquals(parentNotifications, 2)
		assertEquals(childNotifications, 1)
	})

	makeTest("view works fine with zero dependencies", () => {
		let calcCount = 0
		const view = viewBox(() => {
			calcCount++
			return 2 * 2
		})

		assertEquals(view(), 4)
		assertEquals(calcCount, 1)
		assertEquals(view(), 4)
		assertEquals(calcCount, 2)

		let subCalls = 0
		view.subscribe(() => {
			subCalls++
		})

		assertEquals(subCalls, 0)
		assertEquals(view(), 4)
		assertEquals(subCalls, 0)
	})

	makeTest("explicit dependency list in views", () => {
		const a = box(2)
		const b = box(2)
		const c = viewBox(() => a() + b(), [a])

		assertEquals(c(), 4)
		a(3)
		assertEquals(c(), 5)
		b(3)
		assertEquals(c(), 6)
		a(4)
		assertEquals(c(), 7)

		let callsCount = 0
		c.subscribe(() => callsCount++)
		assertEquals(callsCount, 0)
		a(5)
		assertEquals(callsCount, 1)
		assertEquals(c(), 8)
		b(4)
		assertEquals(callsCount, 1)
		assertEquals(c(), 8)
		a(6)
		assertEquals(callsCount, 2)
		assertEquals(c(), 10)
	})

	makeTest("map method", () => {
		const a = box(2)
		const b = box(2)
		const c = a.map(num => num + b())

		assertEquals(c(), 4)
		a(3)
		assertEquals(c(), 5)
		b(3)
		assertEquals(c(), 6)
		a(4)
		assertEquals(c(), 7)

		let callsCount = 0
		c.subscribe(() => callsCount++)
		assertEquals(callsCount, 0)
		a(5)
		assertEquals(callsCount, 1)
		assertEquals(c(), 8)
		b(4)
		assertEquals(callsCount, 1)
		assertEquals(c(), 8)
		a(6)
		assertEquals(callsCount, 2)
		assertEquals(c(), 10)
	})

	makeTest("two same-field prop boxes", () => {
		const p = box({a: 5})
		const a = p.prop("a")
		const b = p.prop("a")

		assertEquals(a(), 5)
		assertEquals(b(), 5)

		a(6)
		assertEquals(a(), 6)
		assertEquals(b(), 6)
		assertEquals(p().a, 6)

		b(7)
		assertEquals(a(), 7)
		assertEquals(b(), 7)
		assertEquals(p().a, 7)

		let callCount = 0
		let lastBValue = b()
		const unsub = b.subscribe(v => {
			lastBValue = v
			callCount++
		})
		assertEquals(callCount, 0)
		assertEquals(lastBValue, 7)
		a(8)
		assertEquals(a(), 8)
		assertEquals(b(), 8)
		assertEquals(callCount, 1)
		assertEquals(lastBValue, 8)
		b(9)
		assertEquals(a(), 9)
		assertEquals(b(), 9)
		assertEquals(callCount, 2)
		assertEquals(lastBValue, 9)
		p({a: 10})
		assertEquals(a(), 10)
		assertEquals(b(), 10)
		assertEquals(callCount, 3)
		assertEquals(lastBValue, 10)

		unsub()
		assertEquals(callCount, 3)
		assertEquals(lastBValue, 10)
		a(11)
		assertEquals(callCount, 3)
		assertEquals(lastBValue, 10)
		assertEquals(a(), 11)
		assertEquals(b(), 11)
		assertEquals(p().a, 11)
	})

	makeTest("prop of viewbox", () => {
		const parent = box({a: 5}) as WBoxInternal<{a: number}>
		const view = viewBox(() => ({...parent(), b: parent().a * 2})) as RBoxInternal<{a: number, b: number}>
		const propA1 = view.prop("a") as RBoxInternal<number>
		const propA2 = view.prop("a") as RBoxInternal<number>
		const propB = view.prop("b") as RBoxInternal<number>

		assertEquals(propA1(), 5)
		assertEquals(propA2(), 5)
		assertEquals(propB(), 10)
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(view.haveSubscribers(), false)
		assertEquals(propA1.haveSubscribers(), false)
		assertEquals(propA2.haveSubscribers(), false)
		assertEquals(propB.haveSubscribers(), false)

		parent({a: 6})

		assertEquals(propA1(), 6)
		assertEquals(propA2(), 6)
		assertEquals(propB(), 12)
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(view.haveSubscribers(), false)
		assertEquals(propA1.haveSubscribers(), false)
		assertEquals(propA2.haveSubscribers(), false)
		assertEquals(propB.haveSubscribers(), false)

		let notifyCount = 0
		const unsub = propA1.subscribe(() => notifyCount++)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(view.haveSubscribers(), true)
		assertEquals(propA1.haveSubscribers(), true)
		assertEquals(propA2.haveSubscribers(), false)
		assertEquals(propB.haveSubscribers(), false)

		parent({a: 7})
		assertEquals(propA1(), 7)
		assertEquals(notifyCount, 1)

		parent({a: 8})
		assertEquals(propA1(), 8)
		assertEquals(notifyCount, 2)

		unsub()
		parent({a: 9})
		assertEquals(propA1(), 9)
		assertEquals(notifyCount, 2)
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(view.haveSubscribers(), false)
		assertEquals(propA1.haveSubscribers(), false)
		assertEquals(propA2.haveSubscribers(), false)
		assertEquals(propB.haveSubscribers(), false)
	})

	makeTest("viewboxes are unsubscribing properly", () => {
		const b = box(5)
		const v = viewBox(() => b() * 2)

		const rb = b as RBoxInternal<number>
		const rv = v as RBoxInternal<number>

		assertEquals(rb.haveSubscribers(), false)
		assertEquals(rv.haveSubscribers(), false)
		assertEquals(v(), 10)
		assertEquals(rb.haveSubscribers(), false)
		assertEquals(rv.haveSubscribers(), false)

		let notifyCount = 0
		const unsub = v.subscribe(() => notifyCount++)
		assertEquals(notifyCount, 0)
		assertEquals(rb.haveSubscribers(), true)
		assertEquals(rv.haveSubscribers(), true)
		assertEquals(v(), 10)

		b(6)
		assertEquals(notifyCount, 1)
		assertEquals(rb.haveSubscribers(), true)
		assertEquals(rv.haveSubscribers(), true)
		assertEquals(v(), 12)

		unsub()
		assertEquals(notifyCount, 1)
		assertEquals(rb.haveSubscribers(), false)
		assertEquals(rv.haveSubscribers(), false)
	})

	makeTest("chain viewboxes are unsubscribing properly", () => {
		const b = box(5)
		const v = viewBox(() => b() * 2)
		const vv = viewBox(() => v() - 2)

		const rb = b as RBoxInternal<number>
		const rv = v as RBoxInternal<number>
		const rvv = vv as RBoxInternal<number>

		assertEquals(rb.haveSubscribers(), false)
		assertEquals(rv.haveSubscribers(), false)
		assertEquals(rvv.haveSubscribers(), false)
		assertEquals(vv(), 8)
		assertEquals(rb.haveSubscribers(), false)
		assertEquals(rv.haveSubscribers(), false)
		assertEquals(rvv.haveSubscribers(), false)

		let notifyCount = 0
		const unsub = vv.subscribe(() => notifyCount++)
		assertEquals(notifyCount, 0)
		assertEquals(rb.haveSubscribers(), true)
		assertEquals(rv.haveSubscribers(), true)
		assertEquals(rvv.haveSubscribers(), true)
		assertEquals(vv(), 8)

		b(6)
		assertEquals(notifyCount, 1)
		assertEquals(rb.haveSubscribers(), true)
		assertEquals(rv.haveSubscribers(), true)
		assertEquals(rvv.haveSubscribers(), true)
		assertEquals(vv(), 10)

		unsub()
		assertEquals(notifyCount, 1)
		assertEquals(rb.haveSubscribers(), false)
		assertEquals(rv.haveSubscribers(), false)
		assertEquals(rvv.haveSubscribers(), false)
	})

	makeTest("propboxes are unsubscribing properly", () => {
		const parent = box({a: 5}) as WBoxInternal<{a: number}>
		const child = parent.prop("a") as WBoxInternal<number>

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)

		parent({a: 6})
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)
		assertEquals(child(), 6)
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)

		child(7)
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)
		assertEquals(parent().a, 7)
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)

		let parentNotifyCount = 0
		const unsubParent = parent.subscribe(() => parentNotifyCount++)
		assertEquals(parentNotifyCount, 0)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), false)
		assertEquals(child(), 7)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), false)

		parent({a: 8})
		assertEquals(parentNotifyCount, 1)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), false)
		assertEquals(child(), 8)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), false)

		let childNotifyCount = 0
		const unsubChild = child.subscribe(() => childNotifyCount++)
		assertEquals(parentNotifyCount, 1)
		assertEquals(childNotifyCount, 0)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), true)

		child(9)
		assertEquals(parentNotifyCount, 2)
		assertEquals(childNotifyCount, 1)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), true)
		assertEquals(child(), 9)
		assertEquals(parent().a, 9)

		unsubParent()
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), true)

		unsubChild()
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)
	})

	makeTest("chain propboxes are unsubscribing properly", () => {
		const parent = box({a: {b: 5}}) as WBoxInternal<{a: {b: number}}>
		const middle = parent.prop("a") as WBoxInternal<{b: number}>
		const child = middle.prop("b") as WBoxInternal<number>

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)

		parent({a: {b: 6}})
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)
		assertEquals(child(), 6)
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)

		child(7)
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)
		assertEquals(parent().a.b, 7)
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)

		let parentNotifyCount = 0
		const unsubParent = parent.subscribe(() => parentNotifyCount++)
		assertEquals(parentNotifyCount, 0)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), false)
		assertEquals(child(), 7)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), false)

		parent({a: {b: 8}})
		assertEquals(parentNotifyCount, 1)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), false)
		assertEquals(child(), 8)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), false)

		let childNotifyCount = 0
		const unsubChild = child.subscribe(() => childNotifyCount++)
		assertEquals(parentNotifyCount, 1)
		assertEquals(childNotifyCount, 0)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), true)

		child(9)
		assertEquals(parentNotifyCount, 2)
		assertEquals(childNotifyCount, 1)
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), true)
		assertEquals(child(), 9)
		assertEquals(parent().a.b, 9)

		unsubParent()
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(child.haveSubscribers(), true)

		unsubChild()
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(child.haveSubscribers(), false)
	})

	makeTest("array wraps without subscribers", () => {
		const parent = box([{id: 1, name: "1"}, {id: 2, name: "2"}]) as WBoxInternal<{id: number, name: string}[]>
		const wrapper = parent.wrapElements(x => x.id)
		const box1 = wrapper()[0]!
		const box2 = wrapper()[1]!

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "1")
		assertEquals(box2().name, "2")

		parent([parent()[0]!, {id: 2, name: "22"}])
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "1")
		assertEquals(box2().name, "22")

		parent([{id: 3, name: "3"}, parent()[0]!, {id: 2, name: "222"}])
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "1")
		assertEquals(box2().name, "222")

		// changing the id within the box
		box2({id: 4, name: "4"})
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "1")
		assertEquals(box2().name, "4")
		assertEquals(box2().id, 4)
		assertEquals(parent()[2]!, box2())

		parent([parent()[0]!, parent()[2]!])
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box2().name, "4")
		assertThrows(box1, /box for key 1 is no longer attached/)
		assertThrows(() => box1({id: 5, name: "5"}), /box for key 1 is no longer attached/)
		assertEquals(parent().length, 2)
	})

	makeTest("array wraps with duplicate keys will throw", () => {
		{
			const parent = box([{id: 1, name: "1"}, {id: 1, name: "2"}])
			const wrap = parent.wrapElements(el => el.id)
			assertThrows(wrap, /key is not unique: 1/)
		}

		{
			const parent = box([{id: 1, name: "1"}, {id: 2, name: "2"}])
			const wrap = parent.wrapElements(el => el.id)
			void wrap() // won't throw yet

			parent([{id: 1, name: "1"}, {id: 1, name: "2"}])
			assertThrows(wrap, /key is not unique: 1/)
		}

		{
			const parent = box([{id: 1, name: "1"}, {id: 2, name: "2"}])
			const wrap = parent.wrapElements(el => el.id)
			const box1 = wrap()[0]!
			assertThrows(() => box1({id: 2, name: "uwu"}), /key is not unique: 2/)
		}
	})

	makeTest("array wraps with subscribers", () => {
		const parent = box([{id: 1, name: "1"}, {id: 2, name: "2"}]) as WBoxInternal<{id: number, name: string}[]>
		const wrapper = parent.wrapElements(x => x.id)
		const box1 = wrapper()[0]!
		const box2 = wrapper()[1]!

		let lastValue = box2()
		let callsCount = 0
		const unsub = box2.subscribe(v => {
			lastValue = v
			callsCount++
		})
		assertEquals(parent.haveSubscribers(), true)

		assertEquals(box1().name, "1")
		assertEquals(box2().name, "2")

		parent([parent()[0]!, {id: 2, name: "22"}])
		assertEquals(box1().name, "1")
		assertEquals(box2().name, "22")
		assertEquals(box2(), lastValue)
		assertEquals(callsCount, 1)

		parent([{id: 3, name: "3"}, parent()[0]!, {id: 2, name: "222"}])
		assertEquals(box1().name, "1")
		assertEquals(box2().name, "222")
		assertEquals(box2(), lastValue)
		assertEquals(callsCount, 2)

		// changing the id within the box
		box2({id: 4, name: "4"})
		assertEquals(box1().name, "1")
		assertEquals(box2().name, "4")
		assertEquals(box2().id, 4)
		assertEquals(parent()[2]!, box2())
		assertEquals(box2(), lastValue)
		assertEquals(callsCount, 3)

		parent([parent()[0]!, parent()[2]!])
		assertEquals(box2().name, "4")
		assertEquals(box2(), lastValue)
		assertEquals(callsCount, 3)
		assertThrows(box1, /box for key 1 is no longer attached/)
		assertThrows(() => box1({id: 5, name: "5"}), /box for key 1 is no longer attached/)
		assertEquals(parent().length, 2)

		unsub()
		assertEquals(parent.haveSubscribers(), false)
	})

	makeTest("chain array wraps without subscribers", () => {
		const parent = box([[{id: 1, name: "1"}, {id: 2, name: "2"}], [{id: 3, name: "3"}]]) as WBoxInternal<{id: number, name: string}[][]>
		const wrapA = parent.wrapElements(arr => arr.length)
		const wrapB = wrapA()[0]!.wrapElements(el => el.id)
		const box1 = wrapB()[0]!

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "1")

		parent([[{id: 1, name: "11"}, parent()[0]![1]!], parent()[1]!])
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "11")

		box1({id: 1, name: "owo"})
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "owo")
		assertEquals(parent()[0]![0]!.name, "owo")

		box1({id: 5, name: "uwu"})
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(parent()[0]![0]!.name, "uwu")

		parent([parent()[1]!, parent()[0]!])
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "uwu")
		assertEquals(box1(), parent()[1]![0]!)

		parent([parent()[0]!, [parent()[1]![1]!, parent()[1]![0]!]])
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "uwu")
		assertEquals(box1(), parent()[1]![1]!)

		box1({id: 6, name: "ayaya"})
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(parent()[1]![1]!.name, "ayaya")

		parent([parent()[0]!, [parent()[1]![0]!]])
		assertThrows(box1, /key is not unique: 1/) // that's about array

		parent([parent()[0]!, [parent()[1]![0]!, {id: 12345, name: "nya"}]])
		assertThrows(box1, /box for key 6 is no longer attached/)
	})

	makeTest("chain array wraps with subscribers", () => {
		const parent = box([[{id: 1, name: "1"}, {id: 2, name: "2"}], [{id: 3, name: "3"}]]) as WBoxInternal<{id: number, name: string}[][]>
		const wrapA = parent.wrapElements(arr => arr.length)
		const wrapB = wrapA()[0]!.wrapElements(el => el.id)
		const box1 = wrapB()[0]!

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "1")

		let lastValue = box1()
		let callCount = 0
		const unsub = box1.subscribe(v => {
			lastValue = v
			callCount++
		})

		assertEquals(parent.haveSubscribers(), true)
		parent([[{id: 1, name: "11"}, parent()[0]![1]!], parent()[1]!])
		assertEquals(box1().name, "11")
		assertEquals(callCount, 1)
		assertEquals(lastValue, box1())
		assertEquals(lastValue, parent()[0]![0]!)

		box1({id: 1, name: "owo"})
		assertEquals(box1().name, "owo")
		assertEquals(parent()[0]![0]!.name, "owo")
		assertEquals(callCount, 2)
		assertEquals(lastValue, box1())

		box1({id: 5, name: "uwu"})
		assertEquals(parent()[0]![0]!.name, "uwu")
		assertEquals(callCount, 3)
		assertEquals(lastValue, box1())

		parent([parent()[1]!, parent()[0]!])
		assertEquals(box1().name, "uwu")
		assertEquals(box1(), parent()[1]![0]!)
		assertEquals(callCount, 3)
		assertEquals(lastValue, box1())

		parent([parent()[0]!, [parent()[1]![1]!, parent()[1]![0]!]])
		assertEquals(box1().name, "uwu")
		assertEquals(box1(), parent()[1]![1]!)
		assertEquals(callCount, 3)
		assertEquals(lastValue, box1())

		box1({id: 6, name: "ayaya"})
		assertEquals(parent()[1]![1]!.name, "ayaya")
		assertEquals(callCount, 4)
		assertEquals(lastValue, box1())
		assertEquals(lastValue, parent()[1]![1]!)

		unsub()
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "ayaya")
		assertEquals(lastValue, box1())
		assertEquals(lastValue, parent()[1]![1]!)
	})

	makeTest("chain array wraps with subscribers throw 1", () => {
		const parent = box([[{id: 1, name: "1"}, {id: 2, name: "2"}], [{id: 3, name: "3"}]]) as WBoxInternal<{id: number, name: string}[][]>
		const wrapA = parent.wrapElements(arr => arr.length)
		const wrapB = wrapA()[0]!.wrapElements(el => el.id)
		const box1 = wrapB()[0]!

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "1")

		let lastValue = box1()
		let callCount = 0
		box1.subscribe(v => {
			lastValue = v
			callCount++
		})

		assertEquals(parent.haveSubscribers(), true)
		parent([[{id: 1, name: "11"}, parent()[0]![1]!], parent()[1]!])
		assertEquals(box1().name, "11")
		assertEquals(callCount, 1)
		assertEquals(lastValue, box1())
		assertEquals(lastValue, parent()[0]![0]!)

		box1({id: 1, name: "owo"})
		assertEquals(box1().name, "owo")
		assertEquals(parent()[0]![0]!.name, "owo")
		assertEquals(callCount, 2)
		assertEquals(lastValue, box1())

		box1({id: 5, name: "uwu"})
		assertEquals(parent()[0]![0]!.name, "uwu")
		assertEquals(callCount, 3)
		assertEquals(lastValue, box1())

		parent([parent()[1]!, parent()[0]!])
		assertEquals(box1().name, "uwu")
		assertEquals(box1(), parent()[1]![0]!)
		assertEquals(callCount, 3)
		assertEquals(lastValue, box1())

		parent([parent()[0]!, [parent()[1]![1]!, parent()[1]![0]!]])
		assertEquals(box1().name, "uwu")
		assertEquals(box1(), parent()[1]![1]!)
		assertEquals(callCount, 3)
		assertEquals(lastValue, box1())

		box1({id: 6, name: "ayaya"})
		assertEquals(parent()[1]![1]!.name, "ayaya")
		assertEquals(callCount, 4)
		assertEquals(lastValue, box1())
		assertEquals(lastValue, parent()[1]![1]!)

		assertThrows(() => parent([parent()[0]!, [parent()[1]![0]!]]), /key is not unique: 1/) // that's about array
	})

	makeTest("chain array wraps with subscribers throw 2", () => {
		const parent = box([[{id: 1, name: "1"}, {id: 2, name: "2"}], [{id: 3, name: "3"}]]) as WBoxInternal<{id: number, name: string}[][]>
		const wrapA = parent.wrapElements(arr => arr.length)
		const wrapB = wrapA()[0]!.wrapElements(el => el.id)
		const box1 = wrapB()[0]!

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "1")

		let lastValue = box1()
		let callCount = 0
		box1.subscribe(v => {
			lastValue = v
			callCount++
		})

		assertEquals(parent.haveSubscribers(), true)
		parent([[{id: 1, name: "11"}, parent()[0]![1]!], parent()[1]!])
		assertEquals(box1().name, "11")
		assertEquals(callCount, 1)
		assertEquals(lastValue, box1())
		assertEquals(lastValue, parent()[0]![0]!)

		box1({id: 1, name: "owo"})
		assertEquals(box1().name, "owo")
		assertEquals(parent()[0]![0]!.name, "owo")
		assertEquals(callCount, 2)
		assertEquals(lastValue, box1())

		box1({id: 5, name: "uwu"})
		assertEquals(parent()[0]![0]!.name, "uwu")
		assertEquals(callCount, 3)
		assertEquals(lastValue, box1())

		parent([parent()[1]!, parent()[0]!])
		assertEquals(box1().name, "uwu")
		assertEquals(box1(), parent()[1]![0]!)
		assertEquals(callCount, 3)
		assertEquals(lastValue, box1())

		parent([parent()[0]!, [parent()[1]![1]!, parent()[1]![0]!]])
		assertEquals(box1().name, "uwu")
		assertEquals(box1(), parent()[1]![1]!)
		assertEquals(callCount, 3)
		assertEquals(lastValue, box1())

		box1({id: 6, name: "ayaya"})
		assertEquals(parent()[1]![1]!.name, "ayaya")
		assertEquals(callCount, 4)
		assertEquals(lastValue, box1())
		assertEquals(lastValue, parent()[1]![1]!)

		parent([parent()[0]!, [parent()[1]![0]!, {id: 12345, name: "nya"}]])
		assertEquals(callCount, 4)
		assertThrows(box1, /box for key 6 is no longer attached/)
	})

	makeTest("chain array wraps with subscribers throw 3", () => {
		const parent = box([[{id: 1, name: "1"}, {id: 2, name: "2"}], [{id: 3, name: "3"}]]) as WBoxInternal<{id: number, name: string}[][]>
		const wrapA = parent.wrapElements(arr => arr.length)
		const wrapB = wrapA()[0]!.wrapElements(el => el.id)
		const box1 = wrapB()[0]!

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "1")

		box1.subscribe(() => {
			// nothing
		})

		assertEquals(parent.haveSubscribers(), true)
		parent([])
		assertThrows(box1, /box for key 1 is no longer attached/)
	})

	makeTest("prop and arraywrap chain with subscribers", () => {
		const parent = box({a: [{id: 5, name: "5"}, {id: 6, name: "6"}]}) as WBoxInternal<{a: {id: number, name: string}[]}>
		const prop = parent.prop("a")
		const arrWrap = prop.wrapElements(el => el.id)
		const box6 = arrWrap()[1]!

		assertEquals(parent.haveSubscribers(), false)

		let lastValue = box6()
		let callCount = 0
		const unsub = box6.subscribe(v => {
			lastValue = v
			callCount++
		})

		assertEquals(parent.haveSubscribers(), true)
		assertEquals(box6().name, "6")
		assertEquals(callCount, 0)

		box6({id: 6, name: "66"})
		assertEquals(box6().name, "66")
		assertEquals(lastValue, box6())
		assertEquals(parent().a[1], box6())
		assertEquals(callCount, 1)

		box6({id: 7, name: "uwu"})
		assertEquals(box6().name, "uwu")
		assertEquals(parent().a[1], box6())
		assertEquals(lastValue, box6())
		assertEquals(callCount, 2)

		parent({a: [{id: 7, name: "owo"}, {id: 5, name: "uwu"}]})
		assertEquals(box6().name, "owo")
		assertEquals(box6().id, 7)
		assertEquals(parent().a[0], box6())
		assertEquals(lastValue, box6())
		assertEquals(callCount, 3)

		unsub()
		assertEquals(parent.haveSubscribers(), false)
	})

	makeTest("arraywrap and prop test chain no sub", () => {
		const parent = box([{id: 1, name: "1"}, {id: 2, name: "2"}]) as WBoxInternal<{id: number, name: string}[]>
		const arrayWrap = parent.wrapElements(el => el.id)
		const prop = arrayWrap()[1]!.prop("name")

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(prop(), "2")

		prop("22")
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(prop(), "22")
		assertEquals(parent()[1]!.name, prop())

		parent([parent()[1]!, parent()[0]!])
		assertEquals(prop(), "22")
		assertEquals(parent()[0]!.name, prop())

		prop("222")
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(prop(), "222")
		assertEquals(parent()[0]!.name, prop())

		parent([{id: 2, name: "uwu"}, parent()[1]!])
		assertEquals(prop(), "uwu")
		assertEquals(parent()[0]!.name, prop())
	})

	makeTest("arraywrap and prop test chain with sub", () => {
		const parent = box([{id: 1, name: "1"}, {id: 2, name: "2"}]) as WBoxInternal<{id: number, name: string}[]>
		const arrayWrap = parent.wrapElements(el => el.id)
		const prop = arrayWrap()[1]!.prop("name")

		assertEquals(parent.haveSubscribers(), false)

		let lastValue = prop()
		let callCount = 0
		const unsub = prop.subscribe(v => {
			lastValue = v
			callCount++
		})

		assertEquals(parent.haveSubscribers(), true)
		assertEquals(prop(), "2")
		assertEquals(lastValue, prop())
		assertEquals(callCount, 0)

		prop("22")
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(prop(), "22")
		assertEquals(parent()[1]!.name, prop())
		assertEquals(lastValue, prop())
		assertEquals(callCount, 1)

		parent([parent()[1]!, parent()[0]!])
		assertEquals(prop(), "22")
		assertEquals(parent()[0]!.name, prop())
		assertEquals(lastValue, prop())
		assertEquals(callCount, 1)

		prop("222")
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(prop(), "222")
		assertEquals(parent()[0]!.name, prop())
		assertEquals(lastValue, prop())
		assertEquals(callCount, 2)

		parent([{id: 2, name: "uwu"}, parent()[1]!])
		assertEquals(prop(), "uwu")
		assertEquals(parent()[0]!.name, prop())
		assertEquals(lastValue, prop())
		assertEquals(callCount, 3)

		unsub()
		assertEquals(parent.haveSubscribers(), false)
	})

	makeTest("arraywrap and viewbox chain no sub", () => {
		const parent = box([{id: 1, name: "1"}, {id: 2, name: "2"}]) as WBoxInternal<{id: number, name: string}[]>
		const wrap = parent.wrapElements(el => el.id)
		const box1 = wrap()[0]!
		const view1 = viewBox(() => box1().name + ", nya")

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(view1(), "1, nya")
		assertEquals(parent()[0]!.name, "1")

		parent([{id: 1, name: "11"}, parent()[1]!])
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(view1(), "11, nya")
		assertEquals(parent()[0]!.name, "11")

		parent([parent()[1]!, {id: 1, name: "11"}])
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(view1(), "11, nya")
		assertEquals(parent()[1]!.name, "11")

		parent([parent()[0]!])
		assertEquals(parent.haveSubscribers(), false)
		assertThrows(view1, /box for key 1 is no longer attached/)
	})

	makeTest("arraywrap and viewbox chain with sub", () => {
		const parent = box([{id: 1, name: "1"}, {id: 2, name: "2"}]) as WBoxInternal<{id: number, name: string}[]>
		const wrap = parent.wrapElements(el => el.id)
		const box1 = wrap()[0]!
		const view1 = viewBox(() => box1().name + ", nya")

		assertEquals(parent.haveSubscribers(), false)
		let lastValue = view1()
		let callCount = 0
		const unsub = view1.subscribe(v => {
			lastValue = v
			callCount++
		})

		assertEquals(parent.haveSubscribers(), true)
		assertEquals(view1(), "1, nya")
		assertEquals(parent()[0]!.name, "1")
		assertEquals(lastValue, view1())
		assertEquals(callCount, 0)

		parent([{id: 1, name: "11"}, parent()[1]!])
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(view1(), "11, nya")
		assertEquals(parent()[0]!.name, "11")
		assertEquals(lastValue, view1())
		assertEquals(callCount, 1)

		parent([parent()[1]!, {id: 1, name: "11"}])
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(view1(), "11, nya")
		assertEquals(parent()[1]!.name, "11")
		assertEquals(lastValue, view1())
		assertEquals(callCount, 1)

		unsub()
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(view1(), "11, nya")
		assertEquals(callCount, 1)
	})

	makeTest("arraywrap and viewbox chain with sub different throw", () => {
		const parent = box([{id: 1, name: "1"}, {id: 2, name: "2"}]) as WBoxInternal<{id: number, name: string}[]>
		const wrap = parent.wrapElements(el => el.id)
		const box1 = wrap()[0]!
		const view1 = viewBox(() => box1().name + ", nya")

		assertEquals(parent.haveSubscribers(), false)
		let lastValue = view1()
		let callCount = 0
		view1.subscribe(v => {
			lastValue = v
			callCount++
		})

		assertEquals(parent.haveSubscribers(), true)
		assertEquals(view1(), "1, nya")
		assertEquals(parent()[0]!.name, "1")
		assertEquals(lastValue, view1())
		assertEquals(callCount, 0)

		parent([{id: 1, name: "11"}, parent()[1]!])
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(view1(), "11, nya")
		assertEquals(parent()[0]!.name, "11")
		assertEquals(lastValue, view1())
		assertEquals(callCount, 1)

		parent([parent()[1]!, {id: 1, name: "11"}])
		assertEquals(parent.haveSubscribers(), true)
		assertEquals(view1(), "11, nya")
		assertEquals(parent()[1]!.name, "11")
		assertEquals(lastValue, view1())
		assertEquals(callCount, 1)

		parent([parent()[0]!])
		assertEquals(parent.haveSubscribers(), false)
		assertThrows(view1, /box for key 1 is no longer attached/)
		assertEquals(callCount, 1)
	})

	makeTest("viewbox and arraywrap chain no sub", () => {
		const parent = box({a: [{id: 1, name: "1"}]}) as WBoxInternal<{a: {id: number, name: string}[]}>
		const view = viewBox(() => parent().a)
		const wrap = view.wrapElements(el => el.id)
		const box1 = wrap()[0]!

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "1")
		assertEquals(box1(), parent().a[0])

		parent({a: [{id: 1, name: "11"}]})
		assertEquals(box1().name, "11")
		assertEquals(box1(), parent().a[0])
		assertEquals(parent.haveSubscribers(), false)

		const prop = parent.prop("a")
		prop([{id: 1, name: "111"}])
		assertEquals(box1().name, "111")
		assertEquals(box1(), parent().a[0])
		assertEquals(parent.haveSubscribers(), false)

		prop([{id: 2, name: "2"}])
		assertThrows(box1, /box for key 1 is no longer attached/)
	})

	makeTest("viewbox and arraywrap chain with sub", () => {
		const parent = box({a: [{id: 1, name: "1"}]}) as WBoxInternal<{a: {id: number, name: string}[]}>
		const view = viewBox(() => parent().a)
		const wrap = view.wrapElements(el => el.id)
		const box1 = wrap()[0]!

		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "1")
		assertEquals(box1(), parent().a[0])

		let lastValue = box1()
		let callCount = 0
		const unsub = box1.subscribe(v => {
			lastValue = v
			callCount++
		})

		assertEquals(parent.haveSubscribers(), true)
		parent({a: [{id: 1, name: "11"}]})
		assertEquals(box1().name, "11")
		assertEquals(box1(), parent().a[0])
		assertEquals(lastValue, box1())
		assertEquals(callCount, 1)

		assertEquals(parent.haveSubscribers(), true)
		const prop = parent.prop("a")
		prop([{id: 1, name: "111"}])
		assertEquals(box1().name, "111")
		assertEquals(box1(), parent().a[0])
		assertEquals(lastValue, box1())
		assertEquals(callCount, 2)

		unsub()
		assertEquals(parent.haveSubscribers(), false)
		assertEquals(box1().name, "111")
		assertEquals(box1(), parent().a[0])
		assertEquals(lastValue, box1())
		assertEquals(callCount, 2)
	})

})