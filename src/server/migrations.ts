import {Migration} from "server/db/db_controller"
import {log} from "server/log"
import * as Path from "path"
import {promises as Fs} from "fs"
import {config, generationTaskDao, thumbnails} from "server/server_globals"
import {ServerPicture} from "server/entities/picture_dao"
import {GenerationTask} from "common/entities/generation_task"
import {runWithMinimalContextWithDb} from "server/context"

export const migrations: Migration[] = [
	{name: "00000_users_gentasks_pictures", handler: async db => {
		await db.run(`create table "users"(
			"id" integer primary key autoincrement,
			"discordAccessToken" text,
			"discordRefreshToken" text,
			"discordId" text,
			"creationTime" bigint not null
		)`)

		await db.run(`create table "generationTasks"(
			"id" integer primary key autoincrement,
			"userId" bigint not null,
			"status" bigint not null,
			"creationTime" bigint not null,
			"startTime" bigint,
			"finishTime" bigint,
			foreign key("userId") references "users"("id")
		)`)

		await db.run(`create table "pictures"(
			"id" integer primary key autoincrement,
			"generationTaskId" bigint not null,
			"creationTime" bigint not null,
			foreign key("generationTaskId") references "generationTasks"("id")
		)`)
	}},

	{name: "00001_add_token_expires_at_to_user", handler: async db => {
		await db.run(`
			alter table "users"
			add "discordTokenExiresAt" bigint;
		`)
	}},

	{name: "00002", handler: async db => {
		await db.run(`
			alter table "users"
			rename column "discordTokenExiresAt" TO "discordTokenExpiresAt";
		`)

		await db.run(`
			alter table "users"
			add "displayName" text;
		`)
	}},

	{name: "00003", handler: async db => {
		await db.run(`
			drop table if exists "generationTasks"
		`)

		await db.run(`
			drop table if exists "pictures"
		`)

		await db.run(`
			drop table if exists "users"
		`)

		await db.run(`create table "pictures"(
			"id" integer primary key autoincrement,
			"generationTaskId" bigint,
			"ownerUserId" bigint not null,
			"creationTime" bigint not null,
			foreign key("generationTaskId") references "generationTasks"("id")
			foreign key("ownerUserId") references "users"("id")
		)`)

		await db.run(`create table "generationTasks"(
			"id" integer primary key autoincrement,
			"userId" bigint not null,
			"status" bigint not null,
			"creationTime" bigint not null,
			"startTime" bigint,
			"finishTime" bigint,
			"prompt" text not null,
			"params" text not null,
			"expectedPictures" bigint,
			"generatedPictures" bigint not null,
			foreign key("userId") references "users"("id")
		)`)

		await db.run(`create table "users"(
			"id" integer primary key autoincrement,
			"discordAccessToken" text,
			"discordRefreshToken" text,
			"discordTokenExpiresAt" bigint,
			"discordId" text,
			"creationTime" bigint not null,
			"displayName" text not null,
			"avatarUrl" text not null
		)`)
	}},

	{name: "00004", handler: async db => {
		await db.run(`
			drop table if exists "generationTasks"
		`)

		await db.run(`
			drop table if exists "pictures"
		`)

		await db.run(`create table "generationTasks"(
			"id" integer primary key autoincrement,
			"userId" bigint not null,
			"status" bigint not null,
			"creationTime" bigint not null,
			"startTime" bigint,
			"finishTime" bigint,
			"prompt" text not null,
			"params" text not null,
			"expectedPictures" bigint,
			"generatedPictures" bigint not null,
			"runOrder" integer,
			foreign key("userId") references "users"("id")
		)`)

		await db.run(`create trigger "generationTasksRunOrderAutoincrement"
			after insert on "generationTasks"
			when new."runOrder" is null
			begin
				update "generationTasks"
				set "runOrder" = (select IFNULL(MAX("runOrder"), 0) + 1 from "generationTasks")
				where id = new.id;
			end
		`)

		await db.run(`create table "pictures"(
			"id" integer primary key autoincrement,
			"generationTaskId" bigint,
			"ownerUserId" bigint not null,
			"creationTime" bigint not null,
			"ext" string not null,
			foreign key("generationTaskId") references "generationTasks"("id"),
			foreign key("ownerUserId") references "users"("id")
		)`)

	}},

	{name: "00005", handler: async db => {
		await db.run(`
			drop trigger "generationTasksRunOrderAutoincrement"
		`)

		await db.run(`create trigger "generationTasksRunOrderAutoincrement"
			after insert on "generationTasks"
			when new."runOrder" < 0
			begin
				update "generationTasks"
				set "runOrder" = (select IFNULL(MAX("runOrder"), 0) + 1 from "generationTasks")
				where id = new.id;
			end
		`)
	}},

	{name: "00006", handler: async db => {
		await db.run(`
			drop table "pictures"
		`)

		await db.run(`create table "pictures"(
			"id" integer primary key autoincrement,
			"generationTaskId" bigint,
			"ownerUserId" bigint not null,
			"creationTime" bigint not null,
			"ext" string not null,
			"directLink" string,
			"fileName" string,
			foreign key("generationTaskId") references "generationTasks"("id"),
			foreign key("ownerUserId") references "users"("id")
		)`)
	}},

	{name: "00007", handler: async db => {
		await db.run(`
			alter table "pictures"
			add "name" text;
		`)
	}},

	{name: "00008", handler: async db => {
		await db.run(`
			alter table "generationTasks"
			add "paramSetName" text;
		`)
	}},

	{name: "00009", handler: async db => {
		await db.run(`
			alter table "generationTasks"
			add "hidden" bool;
		`)
	}},

	{name: "00010", handler: async db => {
		await db.run(`
			update "generationTasks" set "hidden"=?;
		`, [false])
	}},

	{name: "00011", handler: async db => {
		await db.run(`
			alter table "pictures"
			add "salt" bigint;
		`)
		await db.run(`
			update "pictures" set "salt"=abs(random() % 0xffffffff);
		`)
	}},

	{name: "00012", handler: async db => {
		await db.run(`
			alter table "users" add "isAdmin" bool;
		`)
		await db.run(`
			alter table "users" add "isAllowed" bool;
		`)
		await db.run(`
			update "users" set "isAdmin" = false, "isAllowed" = false;
		`)
	}},

	{name: "00013", handler: async db => {
		await db.run(`
			alter table "pictures" add "modifiedArguments" text;
		`)
	}},

	{name: "00014", handler: async db => {
		await db.run(`
			alter table "pictures" add "favoritesAddTime" bigint;
		`)
	}},

	{name: "00015", handler: async db => {
		const hiddenTaskIds = await db.query(`
			select id from "generationTasks" where hidden = true;
		`) as {id: number}[]
		for(const {id: taskId} of hiddenTaskIds){
			const pictures = await db.query(`
				select id, "fileName" from "pictures" where "generationTaskId" = ? and "fileName" is not null
			`, [taskId]) as {id: number, fileName: string}[]

			log(`Deleting previously hidden task #${taskId} with ${pictures.length} pictures`)
			await db.run(`
				delete from "pictures" where "generationTaskId" = ?
			`, [taskId])

			await db.run(`
				delete from "generationTasks" where "id" = ?
			`, [taskId])

			for(const picture of pictures){
				let fullPath = picture.fileName
				try {
					fullPath = Path.resolve(config.pictureStorageDir, picture.fileName)
					await Fs.rm(fullPath)
				} catch(e){
					log(`Failed to delete picture at ${fullPath}: ${e}`)
				}
			}
		}

		await db.run(`
			alter table "generationTasks" drop column "hidden";
		`)
	}},

	{name: "00016", handler: async db => {
		await db.run(`
			alter table "generationTasks"
			rename column "params" TO "arguments";
		`)
	}},

	{name: "00017", handler: async db => {
		const taskArgsAndIds = await db.query(`
			select "id", "arguments", "prompt" from "generationTasks";
		`) as {id: number, arguments: string, prompt: string}[]

		for(const task of taskArgsAndIds){
			try {
				const argsObj = JSON.parse(task.arguments)
				argsObj["prompt"] = task.prompt
				const updatedArguments = JSON.stringify(argsObj)
				log(`Updating task #${task.id}`)
				await db.run(`
					update "generationTasks" set "arguments" = ? where id = ?
				`, [updatedArguments, task.id])
			} catch(e){
				log(`Failed to update task #${task.id}: ${e}. Its prompt was ${JSON.stringify(task.prompt)}. Prompt dropped.`)
			}
		}

		await db.run(`
			alter table "generationTasks" drop column "prompt";
		`)
	}},

	{name: "00018", handler: async db => {
		await db.run(`
			alter table "generationTasks"
			add "exitCode" int;
		`)
	}},

	{name: "00019", handler: async db => {
		await db.run(`
			update "generationTasks" set "exitCode" = 0;
		`)
	}},

	{name: "00020", handler: async db => {
		await thumbnails.start() // ew.
		log("Starting to generate thumbnails for existing pictures.")
		let offset = 0
		const packSize = 10
		const limit: number = ((await db.query("select id from pictures order by id desc limit 1"))[0] as any)["id"]
		while(offset < limit){
			const picturePack = (await db.query(
				"select * from pictures where id >= ? and id < ?",
				[offset, offset + packSize]
			)) as ServerPicture[]
			offset += packSize
			offset = Math.min(offset, limit) // just for beautiful output
			await Promise.all(picturePack.map(async pic => {
				try {
					await thumbnails.makeThumbnail(pic)
				} catch(e){
					log("Conversion failed for " + pic.id + ": " + e)
				}
			}))
			log(`Processed ${offset} out of ${limit}, ${((offset / limit) * 100).toFixed(2)}%...`)
		}
	}},

	{name: "00021", handler: async db => {
		await db.run(`
			alter table "pictures"
			add "deleted" bool;
		`)
	}},

	{name: "00022", handler: async db => {
		await db.run(`
			update "pictures" set "deleted" = false;
		`)
	}},

	{name: "00023", handler: async db => {
		await db.run(`
			alter table "generationTasks"
			add "note" text;
		`)
		await db.run(`
			update "generationTasks" set "note" = '';
		`)
	}},

	{name: "00024", handler: async db => {
		await db.run(`
			create virtual table "generationTasksFts" using fts5(id, "userId", text);
		`)
		log("Starting to build full-text search index.")
		let offset = 0
		const packSize = 100
		const limit: number = ((await db.query("select id from \"generationTasks\" order by id desc limit 1"))[0] as any)["id"]
		await runWithMinimalContextWithDb(db, async() => {
			while(offset < limit){
				const taskPack = (await db.query(
					"select * from \"generationTasks\" where id >= ? and id < ?",
					[offset, offset + packSize]
				)) as GenerationTask[]
				offset += packSize
				offset = Math.min(offset, limit) // just for beautiful output
				for(const task of taskPack){
					// ugh.
					task.arguments = JSON.parse(task.arguments as any)
					await generationTaskDao.updateFullTextSearch(task, true)
				}
				log(`Processed ${offset} out of ${limit}, ${((offset / limit) * 100).toFixed(2)}%...`)
			}
		})
		log("Full-text search index building completed!")
	}},

	{name: "00025", handler: async db => {
		await db.run(`
			alter table "pictures"
			add "isUsedAsArgument" bool;
		`)
	}},

	{name: "00026", handler: async db => {
		await db.run(`
			update "pictures" set "isUsedAsArgument" = "generationTaskId" is null;
		`)
	}}

]