import {Migration} from "server/db_controller"

export const migrations: Migration[] = [
	{name: "00000_init_test", handler: async() => {
		console.log("migration is executed!")
	}}
]