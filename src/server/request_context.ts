import {DbConnection} from "server/db_controller"

export class RequestContext {
	constructor(readonly testValue: string, private readonly db: DbConnection) {
		void this.db
	}
}