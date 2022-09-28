import {allowedFilterOps, FilterField, FilterValue, SimpleListQueryParams} from "common/common_types"
import {UserlessContext} from "server/request_context"

export interface IdentifiedEntity {
	readonly id: number
}

export abstract class DAO<T extends IdentifiedEntity, C extends UserlessContext = UserlessContext, S extends IdentifiedEntity = T> {

	protected abstract getTableName(): string
	protected getLimitLimit(): number {
		return 100
	}

	constructor(protected readonly getContext: () => C) {}

	getById(id: number): Promise<T> {
		return this.getByFieldValue("id", id)
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
		const resultArr: S[] = await this.getContext().db.query(`
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

		await this.getContext().db.query(`
			update "${this.getTableName()}"
			set ${fieldSetters}
			where "id" = ?`, [...fieldValues, convertedItem.id])
	}

	async list(query: SimpleListQueryParams<T>): Promise<T[]> {
		const usedFields = [query.sortBy] as string[]
		const args = [] as unknown[]

		const where = (query.filters || []).map(({a, b, op}) => {
			let aStr, bStr
			if(isFilterField(a)){
				this.validateField(a.field)
				aStr = `"${a.field}"`
			} else {
				aStr = "?"
				args.push(a.value)
			}
			if(isFilterField(b)){
				this.validateField(b.field)
				bStr = `"${b.field}"`
			} else {
				bStr = "?"
				args.push(b.value)
			}

			if(!allowedFilterOps.has(op)){
				throw new Error(`Filtering operator "${op}" is not allowed.`)
			}

			return `${aStr} ${op} ${bStr}`
		}).join("\nor ")

		this.validateFieldNames(usedFields)
		const result: S[] = await this.getContext().db.query(`
			select *
			from "${this.getTableName()}"
			${where ? "where " + where : ""}
			order by "${query.sortBy}" ${query.desc ? "desc" : "asc"}
			limit ${Math.min(this.getLimitLimit(), query.limit)}
		`, args)

		return result.map(x => this.fromDb(x))
	}

	async queryAllFieldIncludes<K extends string & keyof T>(field: K, values: T[K][]): Promise<T[]> {
		this.validateFieldNames([field])
		const placeholders = values.map(() => "?")
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const mappedValues = values.map(x => this.fieldToDb(field as string & keyof T & keyof S, x as any))
		const result: S[] = await this.getContext().db.query(`
			select *
			from "${this.getTableName()}"
			where "${field}" in (${placeholders.join(", ")})
		`, mappedValues)

		return result.map(x => this.fromDb(x))
	}

	protected async mbGetByFieldValue<K extends string & keyof T>(fieldName: K, value: T[K]): Promise<T | undefined> {
		this.validateFieldNames([fieldName])
		const result: S[] = await this.getContext().db.query(`select * from "${this.getTableName()}" where "${fieldName}" = ?`, [
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			this.fieldToDb(fieldName as keyof S & keyof T & string, value as any)
		])
		return !result[0] ? undefined : this.fromDb(result[0])
	}

	protected async getByFieldValue<K extends string & keyof T>(fieldName: K, value: T[K]): Promise<T> {
		this.validateFieldNames([fieldName])
		const result = await this.mbGetByFieldValue(fieldName, value)
		if(!result){
			throw new Error(`Cannot find entity in table ${this.getTableName()} by ${fieldName} = ${value}`)
		}
		return result
	}

	protected async querySortedFiltered<K extends keyof T & string>(fieldName: K, value: T[K], sortBy: string & keyof T, desc: boolean, limit = -1): Promise<T[]> {
		this.validateFieldNames([fieldName, sortBy])
		const result: S[] = await this.getContext().db.query(`
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
		return this.fieldSet ||= this.getContext().dbController.shaper.getFieldSetOfTable(this.getTableName())
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

function isFilterField<T>(x: FilterValue<T>): x is FilterField<T> {
	return typeof((x as FilterField<T>).field) === "string"
}