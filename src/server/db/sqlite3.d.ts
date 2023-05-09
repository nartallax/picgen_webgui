import type * as Sqlite3 from "sqlite3"

// this is a hack to make sqlite3 compatible with esmodules
// .d.ts of sqlite3 does not contain a default export, so you cannot import it
// but in fact our build system/runtime will allow us to do that
// so the only problem is typings
declare module "sqlite3"{
	const sqlite: {Database: typeof Sqlite3.Database}
	export default sqlite
}