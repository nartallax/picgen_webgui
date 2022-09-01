import boxTests from "test/box_tests"
import {failedTests, passedTests} from "test/test_utils"

export async function main() {
	await boxTests()

	if(failedTests.length === 0){
		console.error(`All tests (${passedTests.length}) passed!`)
		process.exit(0)
	} else {
		console.error(`Have ${failedTests.length} failed test(s) out of (${failedTests.length + passedTests.length}):\n${failedTests.map(x => "\t" + x).join("\n")}`)
		process.exit(1)
	}
}