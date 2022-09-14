import {viewBox, box} from "client/base/box"
import {assertEquals, makeTestPack} from "test/test_utils"

export default makeTestPack("box", makeTest => {

	makeTest("wbox simple test", () => {
		const b = box(0)
		const revZero = b.revision
		b(5)

		assertEquals(b(), 5)
		assertEquals(b.revision, revZero + 1)

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
		assertEquals(callCount, 1)
		assertEquals(lastBValue, 8)
		b(9)
		assertEquals(callCount, 2)
		assertEquals(lastBValue, 9)
		p({a: 10})
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
		const parent = box({a: 5})
		const view = viewBox(() => ({...parent(), b: parent().a * 2}))
		const propA1 = view.prop("a")
		const propA2 = view.prop("a")
		const propB = view.prop("b")

		assertEquals(propA1(), 5)
		assertEquals(propA2(), 5)
		assertEquals(propB(), 10)

		parent({a: 6})

		assertEquals(propA1(), 6)
		assertEquals(propA2(), 6)
		assertEquals(propB(), 12)

	})

	// TODO: test for prop of viewbox

})