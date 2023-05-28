import {Migration} from "server/db/db_controller"

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
	}}

]