export const failedTests = [] as string[]
export const passedTests = [] as string[]

type TestFn = () => Promise<void>
type TestCaseMaker = (name: string, action: () => void | Promise<void>) => TestFn

export function makeTestPack(baseName: string, definition: (testCaseMaker: TestCaseMaker) => void): TestFn {

	const cases = [] as TestFn[]

	definition((name, action) => {
		const testFn = makeTest(baseName + " / " + name, action)
		cases.push(testFn)
		return testFn
	})

	return async() => {
		for(const caseFn of cases){
			await caseFn()
		}
	}

}

export function makeTest(name: string, action: () => void | Promise<void>): () => Promise<void> {
	return async() => {
		try {
			await Promise.resolve(action())
			passedTests.push(name)
		} catch(e){
			console.error(`Test ${name} failed: ${(e as Error).stack}`)
			failedTests.push(name)
		}
	}
}

export function assertEquals(a: unknown, b: unknown): void {
	if(a !== b){
		throw new Error(`${a} is not equal to ${b}`)
	}
}