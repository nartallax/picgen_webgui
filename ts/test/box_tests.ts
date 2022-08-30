import {viewBox, wbox} from "client/box/box"
import {assertEquals, makeTestPack} from "test/test_utils"

export default makeTestPack("box", makeTest => {

	makeTest("wbox simple test", () => {
		const box = wbox(0)
		const revZero = box.revision
		box(5)

		assertEquals(box(), 5)
		assertEquals(box.revision, revZero + 1)

		let subscriberCalledTimes = 0
		const unsub = box.subscribe(() => subscriberCalledTimes++)
		assertEquals(subscriberCalledTimes, 0)

		box(10)
		assertEquals(subscriberCalledTimes, 1)
		box(10)
		assertEquals(subscriberCalledTimes, 1)
		box(15)
		assertEquals(subscriberCalledTimes, 2)
		unsub()
		box(7)
		assertEquals(subscriberCalledTimes, 2)
	})

	makeTest("viewBox simple test", () => {
		const a = wbox(0)
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
		const a = wbox(5)
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
		const box = wbox<unknown>({a: 5})
		let calls = 0
		box.subscribe(() => calls++)
		box({a: 10})
		assertEquals(calls, 1)
		box(box())
		assertEquals(calls, 2)
		box(null)
		assertEquals(calls, 3)
		box(null)
		assertEquals(calls, 3)

		const obj = {b: 5}
		box(obj)
		assertEquals(calls, 4)
		box(obj)
		assertEquals(calls, 5)
		box(5)
		assertEquals(calls, 6)
		box(5)
		assertEquals(calls, 6)
	})

	makeTest("view only subscribes to direct dependencies", () => {
		const a = wbox(5)
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
		const box = wbox(0)
		box.subscribe(v => box(Math.floor(v / 2) * 2))
		let lastVisibleValue = box()
		let callsCount = 0
		box.subscribe(v => {
			lastVisibleValue = v
			callsCount++
		})

		box(1)
		assertEquals(callsCount, 0)
		assertEquals(lastVisibleValue, 0)
		box(2)
		assertEquals(callsCount, 1)
		assertEquals(lastVisibleValue, 2)
		box(3)
		assertEquals(callsCount, 1)
		assertEquals(lastVisibleValue, 2)
		box(4)
		assertEquals(callsCount, 2)
		assertEquals(lastVisibleValue, 4)
	})

	makeTest("basic property subbox test", () => {
		const parent = wbox({a: 5})
		const child = parent.makePropertySubBox("a")

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
		const parent = wbox([1, 2, 3])
		const child = parent.makePropertySubBox(3)

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
		const parent = wbox({a: {c: 5}, b: {d: "uwu"}})
		const childA = parent.makePropertySubBox("a")
		const childB = parent.makePropertySubBox("b")

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
		const parent = wbox({a: {b: {c: 5}}})
		const middle = parent.makePropertySubBox("a")
		const child = middle.makePropertySubBox("b")
		let parentCalls = 0
		parent.subscribe(() => parentCalls++)
		let childCalls = 0
		child.subscribe(() => childCalls++)
		// TODO: same tests, no middle subscriber
		let middleCalls = 0
		middle.subscribe(() => middleCalls++)

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

	})

	makeTest("chain property subboxes with middle one implicit subscrption", () => {
		const parent = wbox({a: {b: {c: 5}}})
		const middle = parent.makePropertySubBox("a")
		const child = middle.makePropertySubBox("b")
		let parentCalls = 0
		parent.subscribe(() => parentCalls++)
		let childCalls = 0
		child.subscribe(() => childCalls++)

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
	})

	makeTest("chain property subboxes with only top sub", () => {
		const parent = wbox({a: {b: {c: 5}}})
		const middle = parent.makePropertySubBox("a")
		const child = middle.makePropertySubBox("b")
		let parentCalls = 0
		parent.subscribe(() => parentCalls++)

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
	})

	makeTest("chain property subboxes with only bottom sub", () => {
		const parent = wbox({a: {b: {c: 5}}})
		const middle = parent.makePropertySubBox("a")
		const child = middle.makePropertySubBox("b")
		let childCalls = 0
		child.subscribe(() => childCalls++)

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
	})

})