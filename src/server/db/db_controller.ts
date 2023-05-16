import {SqliteDbShapeController} from "server/db/sqlite_db_shape_controller"
import {log} from "server/log"
import {errToString} from "server/utils/err_to_string"
import {unixtime} from "server/utils/unixtime"
import Sqlite from "sqlite3"
import type {Database as SqliteDatabase} from "sqlite3"

export interface DbConnection {
	run(queryStr: string, params?: readonly unknown[]): Promise<void>
	query<T = unknown>(queryStr: string, params?: readonly unknown[]): Promise<T[]>
	flushTransaction(): Promise<void>
}

export interface Migration {
	name: string
	handler(conn: DbConnection): Promise<void>
}

// Q: why this number?
// A: because if we go higher than this count simultaneous writing queries to db, queries will start to die because of timeout
// so we need to limit amount of simultaneously running connections
const maxSimultaneouslyOpenConnections = 1

export class DbController {
	private connWaiters = [] as (() => void)[]
	private openConnectionsCount = 0

	readonly shaper = new SqliteDbShapeController()

	constructor(readonly dbPath: string, readonly migrations: Migration[]) {}

	async init(): Promise<void> {
		await this.migrate()
		await this.inTransaction(conn => this.shaper.init(conn))
	}

	async inTransaction<T>(action: (conn: DbConnectionImpl) => T | Promise<T>): Promise<T> {
		while(this.openConnectionsCount >= maxSimultaneouslyOpenConnections){
			await this.waitConnectionClosed()
		}
		this.openConnectionsCount++

		const conn = new DbConnectionImpl(() => this.openConnection())
		try {
			return await Promise.resolve(action(conn))
		} catch(e){
			try {
				await conn.close(true, true)
			} catch(ee){
				log("Error while closing connection: " + errToString(ee))
			}
			throw e
		} finally {
			await conn.close(false, true)
			this.openConnectionsCount--
			this.callConnectionCloseWaiters()
		}
	}

	private callConnectionCloseWaiters(): void {
		const waiters = [...this.connWaiters]
		this.connWaiters = []
		for(const waiter of waiters){
			waiter()
		}
	}

	private waitConnectionClosed(): Promise<void> {
		return new Promise(ok => this.connWaiters.push(ok))
	}

	async waitAllConnectionsClosed(): Promise<void> {
		while(this.openConnectionsCount > 0){
			await this.waitConnectionClosed()
		}
	}

	private openConnection(): Promise<SqliteDatabase> {
		return new Promise((ok, bad) => {
			const db = new Sqlite.Database(this.dbPath, err => {
				if(err){
					bad(err)
					return
				}

				db.on("error", err => {
					log("DB gives error: " + err.stack || err.message)
				})

				ok(db)
			})
		})
	}

	private async migrate(): Promise<void> {
		const knownMigrations = await this.inTransaction(async conn => {
			await conn.run(`create table if not exists migrations(
				name text not null,
				time int not null
			)`)

			const knownMigrations: {name: string}[] = await conn.query("select * from migrations")
			return new Set<string>(knownMigrations.map(x => x.name))
		})

		for(const migration of this.migrations){
			if(knownMigrations.has(migration.name)){
				continue
			}

			await this.inTransaction(async conn => {
				await Promise.resolve(migration.handler(conn))
				await conn.run("insert into migrations(name, time) values (?, ?)", [migration.name, unixtime()])
			})
		}
	}
}

type DbConnectionState = "not_open" | "opening" | "open" | "closing" | "finalized"

class DbConnectionImpl implements DbConnection {
	private db: SqliteDatabase | null = null
	private state: DbConnectionState = "not_open"

	constructor(private readonly dbOpener: () => Promise<SqliteDatabase>) {}

	private ensureState(state: DbConnectionState): void {
		if(this.state !== state){
			throw new Error(`DB connection is in bad state: expected ${state}, got ${this.state}`)
		}
	}

	private async getConn(): Promise<SqliteDatabase> {
		if(!this.db){
			this.ensureState("not_open")
			this.state = "opening"
			this.db = await this.dbOpener()
			this.db.serialize() // https://github.com/TryGhost/node-sqlite3/wiki/Control-Flow
			await this.postOpenConn(this.db)
			this.state = "open"
		}
		this.ensureState("open")
		return this.db
	}

	private async postOpenConn(db: SqliteDatabase): Promise<void> {
		// to wait before throwing error on busy connection
		// https://github.com/TryGhost/node-sqlite3/wiki/API#databaseconfigureoption-value
		db.configure("busyTimeout", 5000)

		// write-ahead logging for better concurrent access
		// https://github.com/TryGhost/node-sqlite3/issues/747
		await this.run("PRAGMA journal_mode=wal", [], db)
		await this.run("BEGIN TRANSACTION", [], db)
	}

	async close(withError: boolean, final?: boolean): Promise<void> {
		if(!this.db){
			return
		}
		this.ensureState("open")
		this.state = "closing"
		const db = this.db
		const runPromise = this.run(withError ? "ROLLBACK" : "COMMIT", [], db)
		this.db = null
		await runPromise
		await this.closeDb(db)
		this.state = final ? "finalized" : "not_open"
	}

	private closeDb(db: SqliteDatabase): Promise<void> {
		return new Promise((ok, bad) => {
			db.close(err => err ? bad(err) : ok())
		})
	}

	async run(queryStr: string, params?: readonly unknown[], preOpenedConn?: SqliteDatabase): Promise<void> {
		const conn = preOpenedConn ?? await this.getConn()
		await new Promise<void>((ok, bad) => {
			conn.run(queryStr, params, err => {
				err ? bad(new Error(`Failed to run query "${queryStr} because of ${err}`)) : ok()
			})
		})
	}

	async query<T = unknown>(queryStr: string, params?: readonly unknown[]): Promise<T[]> {
		const conn = await this.getConn()
		// console.log(queryStr, params)
		return await new Promise((ok, bad) => {
			conn.all(queryStr, params, (err, rows) => {
				err ? bad(new Error(`Failed to run query "${queryStr} because of ${err}`)) : ok(rows as T[])
			})
		})
	}

	flushTransaction(): Promise<void> {
		return this.close(false)
	}
}