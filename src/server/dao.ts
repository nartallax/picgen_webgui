import {ApiError} from "common/infra_entities/api_error"
import {BinaryQueryCondition} from "common/infra_entities/query"
import {FilterField, FilterValue, SimpleListQueryParams, allowedFilterOps} from "common/infra_entities/query"
import {context, dbController} from "server/server_globals"

export type IdentifiedEntity = {
	readonly id: number
}

export abstract class DAO<T extends IdentifiedEntity, S extends IdentifiedEntity = T> {

	protected abstract getTableName(): string
	protected getMaxQueryRows(): number {
		return 1000
	}

	getById(id: number): Promise<T> {
		return this.getByFieldValue("id", id)
	}

	queryById(id: number): Promise<T | null> {
		return this.queryByFieldValue("id", id)
	}

	async getByIds(ids: readonly number[]): Promise<T[]> {
		const result: S[] = await context.get().db.query(
			`select * from "${this.getTableName()}" where id in (${ids.map(() => "?").join(", ")})`,
			ids
		)
		if(result.length !== ids.length){
			const foundIds = new Set(result.map(x => x.id))
			const absentIds = ids.filter(id => !foundIds.has(id))
			throw new ApiError("generic", "Not found entities with id(s): " + absentIds.join(", "))
		}
		return result.map(x => this.fromDb(x))
	}

	protected fieldFromDb<K extends keyof S & keyof T & string>(field: K, value: S[K]): unknown {
		void field
		return value
	}
	protected fieldToDb<K extends keyof S & keyof T & string>(field: K, value: T[K]): unknown {
		void field
		return value
	}

	private fromDb(input: S): T
	private fromDb(input: Partial<S>): Partial<T>
	private fromDb(input: S): T {
		if(this.fieldFromDb === DAO.prototype.fieldFromDb){
			return input as unknown as T
		}
		const result = {} as Record<string, unknown>
		for(const k in input){
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			result[k] = this.fieldFromDb(k as string & keyof T & keyof S, input[k] as any)
		}
		return result as T
	}

	private toDb(input: T): S
	private toDb(input: Partial<T>): Partial<S>
	private toDb(input: T): S {
		if(this.fieldToDb === DAO.prototype.fieldToDb){
			return input as unknown as S
		}
		const result = {} as Record<string, unknown>
		for(const k in input){
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			result[k] = this.fieldToDb(k as string & keyof T & keyof S, input[k] as any)
		}
		return result as S
	}

	async create(item: Omit<T, "id">): Promise<T> {
		const convertedItem = this.toDb(item as Partial<T>)
		const fields = Object.keys(convertedItem).filter(x => x !== "id")
		this.validateFieldNames(fields)
		const fieldsStr = fields.map(x => `"${x}"`).join(", ")
		const placeholdersStr = fields.map(() => "?").join(", ")
		const fieldValues = fields.map(fieldName => convertedItem[fieldName as keyof Omit<S, "id">])
		const resultArr: S[] = await context.get().db.query(`
			insert into "${this.getTableName()}"(${fieldsStr})
			values (${placeholdersStr})
			returning *`, fieldValues)
		if(resultArr.length !== 1){
			throw new Error(`Failed to insert value into ${this.getTableName()}`)
		}
		return this.fromDb(resultArr[0]!)
	}

	async update(item: T): Promise<void> {
		const convertedItem = this.toDb(item)
		const fields = Object.keys(convertedItem).filter(x => x !== "id")
		this.validateFieldNames(fields)
		const fieldSetters = fields.map(field => `"${field}" = ?`).join(", ")
		const fieldValues = fields.map(fieldName => convertedItem[fieldName as keyof Omit<S, "id">])

		await context.get().db.query(`
			update "${this.getTableName()}"
			set ${fieldSetters}
			where "id" = ?`, [...fieldValues, convertedItem.id])

	}

	async delete(item: T): Promise<void> {
		await context.get().db.query(`
			delete from "${this.getTableName()}"
			where "id" = ?`, [item.id])
	}

	async list(query: SimpleListQueryParams<T>): Promise<T[]> {
		const usedFields: string[] = query.sortBy ? [query.sortBy] : []
		const args = [] as unknown[]

		let where = (query.filters || []).map(filter => this.filterToQueryPart(filter, args)).join("\nand ")

		this.validateFieldNames(usedFields)
		const limit = "limit " + Math.min(this.getMaxQueryRows(), query.limit ?? Number.MAX_SAFE_INTEGER)
		where = !where ? "" : "where " + where
		const sortBy = !query.sortBy ? "" : `order by "${query.sortBy}" ${(query.desc ? " desc" : " asc")}`
		const result: S[] = await context.get().db.query(`
			select *
			from "${this.getTableName()}"
			${where}
			${sortBy}
			${limit}
		`, args)

		return result.map(x => this.fromDb(x))
	}

	private filterToQueryPart(filter: BinaryQueryCondition<T>, args: unknown[]): string {
		const {a, b, op} = filter
		if(!allowedFilterOps.has(op)){
			throw new Error(`Filtering operator "${op}" is not allowed.`)
		}

		const bIsNull = !isFilterField(b) && b.value === null
		if(bIsNull && (op === "=" || op === "!=")){
			return `${this.filterValueToQueryPart(a, args)} is ${op === "!=" ? "not " : ""}null`
		}

		const aIsNull = !isFilterField(a) && a.value === null
		if(!bIsNull && aIsNull && (op === "=" || op === "!=")){
			// just to avoid repeating myself
			return this.filterToQueryPart({a: b, b: a, op}, args)
		}

		const aStr = this.filterValueToQueryPart(a, args)
		const bStr = this.filterValueToQueryPart(b, args)

		return `${aStr} ${op} ${bStr}`
	}

	private filterValueToQueryPart(value: FilterValue<T>, args: unknown[]): string {
		if(isFilterField(value)){
			this.validateField(value.field)
			return `"${value.field}"`
		} else if(Array.isArray(value.value)){
			let result = "("
			let first = true
			for(const arrItem of value.value){
				if(first){
					first = false
				} else {
					result += ", "
				}
				result += "?"
				args.push(arrItem)
			}
			result += ")"
			return result
		} else {
			args.push(value.value)
			return "?"
		}
	}

	async queryAllFieldIncludes<K extends string & keyof T>(field: K, values: T[K][]): Promise<T[]> {
		this.validateFieldNames([field])
		const placeholders = values.map(() => "?")
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const mappedValues = values.map(x => this.fieldToDb(field as string & keyof T & keyof S, x as any))
		const result: S[] = await context.get().db.query(`
			select *
			from "${this.getTableName()}"
			where "${field}" in (${placeholders.join(", ")})
		`, mappedValues)

		return result.map(x => this.fromDb(x))
	}

	async queryAll(): Promise<T[]> {
		const result: S[] = await context.get().db.query(`select * from "${this.getTableName()}"`)
		return result.map(x => this.fromDb(x))
	}

	protected async queryByFieldValue<K extends string & keyof T>(fieldName: K, value: T[K]): Promise<T | null> {
		this.validateFieldNames([fieldName])
		const result: S[] = await context.get().db.query(`select * from "${this.getTableName()}" where "${fieldName}" = ?`, [
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this.fieldToDb(fieldName as keyof S & keyof T & string, value as any)
		])
		return !result[0] ? null : this.fromDb(result[0])
	}

	protected async queryAllByFieldValue<K extends string & keyof T>(fieldName: K, value: T[K]): Promise<T[]> {
		this.validateFieldNames([fieldName])
		const result: S[] = await context.get().db.query(`select * from "${this.getTableName()}" where "${fieldName}" = ?`, [
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this.fieldToDb(fieldName as keyof S & keyof T & string, value as any)
		])
		return result.map(x => this.fromDb(x))
	}

	protected async getByFieldValue<K extends string & keyof T>(fieldName: K, value: T[K]): Promise<T> {
		this.validateFieldNames([fieldName])
		const result = await this.queryByFieldValue(fieldName, value)
		if(result === null){
			throw new Error(`Cannot find entity in table ${this.getTableName()} by ${fieldName} = ${value}`)
		}
		return result
	}

	protected async querySortedFiltered<K extends keyof T & string>(fieldName: K, value: T[K], sortBy: string & keyof T, desc: boolean, limit = -1): Promise<T[]> {
		this.validateFieldNames([fieldName, sortBy])
		const result: S[] = await context.get().db.query(`
			select * 
			from "${this.getTableName()}"
			where "${fieldName}" = ?
			order by "${sortBy}" ${desc ? "desc" : "asc"}
			${limit > 0 ? "limit " + limit : ""}
		`,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[this.fieldToDb(fieldName as keyof T & keyof S & string, value as any)])
		return result.map(x => this.fromDb(x))
	}

	private fieldSet: ReadonlySet<string> | null = null
	private getFieldSet(): ReadonlySet<string> {
		return this.fieldSet ||= dbController.shaper.getFieldSetOfTable(this.getTableName())
	}

	private validateFieldNames(fieldList: readonly string[]): void {
		const fieldSet = this.getFieldSet()
		for(const field of fieldList){
			if(!fieldSet.has(field)){
				throw new Error(`Table "${this.getTableName()}" is not supposed to have field "${field}"!`)
			}
		}
	}

	private isField(x: unknown): x is keyof T & keyof S & string {
		return this.getFieldSet().has(x as string)
	}

	private validateField(x: unknown): asserts x is keyof T & keyof S & string {
		if(!this.isField(x)){
			throw new Error(`Table "${this.getTableName()}" is not supposed to have field "${x}"!`)
		}
	}

}

function isFilterField<T extends Record<string, unknown>>(x: FilterValue<T>): x is FilterField<T> {
	return typeof((x as FilterField<T>).field) === "string"
}