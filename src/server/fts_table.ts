import {context} from "server/server_globals"

export class FtsTable {
	constructor(readonly tableName: string, readonly oldestFirst = false) {}

	private normalize(text: string): string {
		return text.toLowerCase().replace(/[^a-z\d]/g, " ").replace(/\s{2,}/g, " ")
	}

	async add(id: number, userId: number, search: string[]): Promise<void> {
		const text = this.normalize(search.join(" "))
		await context.get().db.run(`insert into "${this.tableName}"(id, "userId", text) values (?, ?, ?)`, [id, userId, text])
	}

	async update(id: number, search: string[]): Promise<void> {
		const text = this.normalize(search.join(" "))
		await context.get().db.run(`update "${this.tableName}" set text = ? where id = ?`, [text, id])
	}

	async delete(id: number): Promise<void> {
		await context.get().db.run(`delete from "${this.tableName}" where id = ?`, [id])
	}

	async search(text: string, pageSize: number, userId: number | null, lastKnownId: number | null): Promise<number[]> {
		text = this.normalize(text)
		let query = `select id from "${this.tableName}" where text match ?`
		const args: unknown[] = [text]
		if(lastKnownId !== null){
			query += ` and id ${this.oldestFirst ? ">" : "<"} ?`
			args.push(lastKnownId)
		}
		if(userId !== null){
			query += " and \"userId\" = ?"
			args.push(userId)
		}
		query += ` order by id${this.oldestFirst ? "" : " desc"}`
		query += " limit ?"
		args.push(pageSize)
		const rows = await context.get().db.query(query, args) as {id: number}[]
		return rows.map(row => row.id)
	}

}