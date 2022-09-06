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
			"runOrder" integer autoincrement,
			foreign key("userId") references "users"("id")
		)`)

		await db.run(`create table "pictures"(
			"id" integer primary key autoincrement,
			"generationTaskId" bigint,
			"ownerUserId" bigint not null,
			"creationTime" bigint not null,
			"ext" string not null,
			foreign key("generationTaskId") references "generationTasks"("id")
			foreign key("ownerUserId") references "users"("id")
		)`)

	}}


]