export function urlencodeParams(params: Record<string, string>): string {
	const result = [] as string[]
	for(const key in params){
		const value = params[key]!
		result.push(encodeURIComponent(key) + "=" + encodeURIComponent(value))
	}
	return result.join("&")
}