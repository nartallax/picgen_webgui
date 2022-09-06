import {DbConnection} from "server/db/db_controller"

export type TableShape = ReadonlySet<string> // keeping it simple for now

// sqlite-specific set of queries to get the idea about what database looks like
export class SqliteDbShapeController {

	private readonly knownTables = new Map<string, TableShape>()

	async init(conn: DbConnection): Promise<void> {
		const tableList: {name: string}[] = await conn.query(`
			select name from sqlite_schema where type='table' and name not like 'sqlite%'
		`)

		for(const {name: tableName} of tableList){
			// there's more of it, but let it just be name for now
			const tableFields: {name: string}[] = await conn.query(`PRAGMA table_info("${tableName}")`)
			const nameList = new Set(tableFields.map(x => x.name))
			this.knownTables.set(tableName, nameList)
		}
	}

	getFieldSetOfTable(table: string): ReadonlySet<string> {
		const result = this.knownTables.get(table)
		if(!result){
			throw new Error(`There is no table "${table}"`)
		}
		return result
	}

}