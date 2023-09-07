import {context} from "server/server_globals"

export class FtsTable {
	// CREATE VIRTUAL TABLE search_table USING fts5(id, text);
	constructor(readonly tableName: string, readonly oldestFirst = false) {}

	private normalize(text: string): string {
		return text.toLowerCase().replace(/[^a-z\d]/g, " ").replace(/\s{2,}/g, " ")
	}

	async add(id: number, ...search: string[]): Promise<void> {
		const text = this.normalize(search.join(" "))
		await context.get().db.run(`insert into "${this.tableName}"(id, text) values (?, ?)`, [id, text])
	}

	async search(text: string, pageSize: number, lastKnownId: number | null): Promise<number[]> {
		text = this.normalize(text)
		let query = `select id from "${this.tableName}" where text match ?`
		const args: unknown[] = [text]
		if(lastKnownId !== null){
			query += ` and id ${this.oldestFirst ? ">" : "<"} ?`
			args.push(lastKnownId)
		}
		query += ` order by id${this.oldestFirst ? "" : " desc"}`
		query += " limit ?"
		args.push(pageSize)
		const rows = await context.get().db.query(query, args) as {id: number}[]
		return rows.map(row => row.id)
	}

}