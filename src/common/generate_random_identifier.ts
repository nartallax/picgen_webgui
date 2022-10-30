function randomHex(): string {
	let res = Math.floor(Math.random() * 0xffffffff).toString(16).toLowerCase()
	while(res.length < 8){
		res = "0" + res
	}
	return res
}

export function generateRandomIdentifier(isExisting: (identifier: string) => boolean): string
export function generateRandomIdentifier(isExisting: (identifier: string) => Promise<boolean>): Promise<string>
export function generateRandomIdentifier(isExisting: (identifier: string) => boolean | Promise<boolean>): string | Promise<string> {
	while(true){
		const result = randomHex() + randomHex() + randomHex() + randomHex()
		const checkResult = isExisting(result)
		if(checkResult instanceof Promise){
			return checkResult.then(exists => !exists
				? result
				: generateRandomIdentifier(isExisting as (identifier: string) => Promise<boolean>)
			)
		} else if(!checkResult){
			return result
		}
	}
}