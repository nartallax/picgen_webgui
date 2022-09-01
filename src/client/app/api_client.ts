export class ApiClient {

	constructor(readonly urlBase: string) {}

	async call(name: string, input: unknown): Promise<unknown> {
		const resp = await fetch(this.urlBase + name, {
			method: "POST",
			body: JSON.stringify(input)
		})
		return await resp.json()
	}

}