export const failedTests = [] as string[]
export const passedTests = [] as string[]

type TestFn = () => Promise<void>
type TestCaseMaker = (name: string, action: () => void | Promise<void>) => TestFn

export function makeTestPack(baseName: string, definition: (testCaseMaker: TestCaseMaker) => void): (name?: string) => Promise<void> {

	const cases = [] as {name: string, fn: TestFn}[]

	definition((name, action) => {
		const fullName = baseName + " / " + name
		const testFn = makeTest(fullName, action)
		cases.push({name: fullName, fn: testFn})
		return testFn
	})

	return async(targetName?: string) => {
		for(const {name, fn} of cases){
			if(targetName !== undefined && name !== targetName){
				continue
			}
			await fn()
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

export function assertThrows(fn: () => void, msg: string | RegExp): void {
	try {
		fn()
	} catch(e){
		if(e instanceof Error){
			if(msg instanceof RegExp){
				if(msg.test(e.message)){
					return
				}
			} else if(e.message === msg){
				return
			}
			throw new Error(`Bad error was thrown: expected "${msg}", got "${e.message}"`)
		}
		throw e
	}
	throw new Error(`Expected function ${fn} to throw "${msg}", but it did not.`)
}