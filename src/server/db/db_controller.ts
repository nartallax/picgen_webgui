import {SqliteDbShapeController} from "server/db/sqlite_db_shape_controller"
import {log} from "server/log"
import {unixtime} from "server/utils/unixtime"
import * as Sqlite from "sqlite3"

export interface DbConnection {
	run(queryStr: string, params?: readonly unknown[]): Promise<void>
	query<T = unknown>(queryStr: string, params?: readonly unknown[]): Promise<T[]>
}

export interface Migration {
	name: string
	handler(conn: DbConnection): Promise<void>
}

// Q: why this number?
// A: because if we go higher than this count simultaneous writing queries to db, queries will start to die because of timeout
// so we need to limit amount of simultaneously running connections
const maxSimultaneouslyOpenConnections = 4

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
		const conn = new DbConnectionImpl(() => this.openConnectionLimited())
		try {
			return await Promise.resolve(action(conn))
		} catch(e){
			await conn.close(true)
			throw e
		} finally {
			await conn.close(false)
			this.notifyConnectionClosed()
		}
	}

	private notifyConnectionClosed(): void {
		this.openConnectionsCount--
		const waiter = this.connWaiters[0]
		if(waiter){
			this.connWaiters = this.connWaiters.splice(1)
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

	private async openConnectionLimited(): Promise<Sqlite.Database> {
		while(this.openConnectionsCount >= maxSimultaneouslyOpenConnections){
			await this.waitConnectionClosed()
		}
		this.openConnectionsCount++
		return await this.openConnection()
	}

	private openConnection(): Promise<Sqlite.Database> {
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

class DbConnectionImpl implements DbConnection {
	private db: Sqlite.Database | null = null

	constructor(private readonly dbOpener: () => Promise<Sqlite.Database>) {}

	private async getConn(): Promise<Sqlite.Database> {
		if(!this.db){
			this.db = await this.dbOpener()
			this.db.serialize() // https://github.com/TryGhost/node-sqlite3/wiki/Control-Flow
			await this.postOpenConn()
		}
		return this.db
	}

	private async postOpenConn(): Promise<void> {
		const db = await this.getConn()
		// to wait before throwing error on busy connection
		// https://github.com/TryGhost/node-sqlite3/wiki/API#databaseconfigureoption-value
		db.configure("busyTimeout", 2000)

		// write-ahead logging for better concurrent access
		// https://github.com/TryGhost/node-sqlite3/issues/747
		await this.run("PRAGMA journal_mode=wal")
		await this.run("BEGIN TRANSACTION")
	}

	async close(withError: boolean): Promise<void> {
		if(!this.db){
			return
		}
		await this.run(withError ? "ROLLBACK" : "COMMIT")
		await this.closeDb(this.db)
		this.db = null
	}

	private closeDb(db: Sqlite.Database): Promise<void> {
		return new Promise((ok, bad) => {
			db.close(err => err ? bad(err) : ok())
		})
	}

	async run(queryStr: string, params?: readonly unknown[]): Promise<void> {
		const conn = await this.getConn()
		await new Promise<void>((ok, bad) => {
			conn.run(queryStr, params, err => {
				err ? bad(new Error(`Failed to run query "${queryStr} because of ${err}`)) : ok()
			})
		})
	}

	async query<T = unknown>(queryStr: string, params?: readonly unknown[]): Promise<T[]> {
		const conn = await this.getConn()
		return await new Promise((ok, bad) => {
			conn.all(queryStr, params, (err, rows) => {
				err ? bad(new Error(`Failed to run query "${queryStr} because of ${err}`)) : ok(rows)
			})
		})
	}
}