import {DbConnection} from "server/db_controller"

export interface IdentifiedEntity {
	readonly id: number
}

export abstract class DAO<T extends IdentifiedEntity> {

	protected abstract getTableName(): string

	constructor(protected readonly db: DbConnection) {}

	getById(id: number): Promise<T> {
		return this.getByFieldValue("id", id)
	}

	async create(item: Omit<T, "id">): Promise<T> {
		const fields = Object.keys(item).filter(x => x !== "id")
		const fieldsStr = fields.map(x => `"${x}"`).join(", ")
		const placeholdersStr = fields.map(() => "?").join(", ")
		const fieldValues = fields.map(fieldName => item[fieldName as keyof Omit<T, "id">])
		const resultArr: T[] = await this.db.query(`
			insert into "${this.getTableName()}"(${fieldsStr})
			values (${placeholdersStr})
			returning *`, fieldValues)
		if(resultArr.length !== 1){
			throw new Error(`Failed to insert value into ${this.getTableName()}`)
		}
		return resultArr[0]!
	}

	async update(item: T): Promise<void> {
		const fields = Object.keys(item).filter(x => x !== "id")
		const fieldSetters = fields.map(field => `"${field}" = ?`).join(", ")
		const fieldValues = fields.map(fieldName => item[fieldName as keyof Omit<T, "id">])

		await this.db.query(`
			update "${this.getTableName()}"
			set ${fieldSetters}
			where "id" = ?`, [...fieldValues, item.id])
	}

	protected async mbGetByFieldValue(fieldName: string & keyof T, value: unknown): Promise<T | undefined> {
		const result: T[] = await this.db.query(`select * from "${this.getTableName()}" where "${fieldName}" = ?`, [value])
		return result[0]
	}

	protected async getByFieldValue(fieldName: string & keyof T, value: unknown): Promise<T> {
		const result = await this.mbGetByFieldValue(fieldName, value)
		if(!result){
			throw new Error(`Cannot find entity in table ${this.getTableName()} by ${fieldName} = ${value}`)
		}
		return result
	}

}