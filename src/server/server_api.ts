import {ApiError} from "common/infra_entities/api_error"
import {RC} from "@nartallax/ribcage"
import {RCV} from "@nartallax/ribcage-validation"
import {GenerationParameterSet} from "common/entities/parameter"
import {User} from "common/entities/user"
import {GenerationTask, GenerationTaskInputData, GenerationTaskWithPictures} from "common/entities/generation_task"
import {SimpleListQueryParams} from "common/infra_entities/query"
import {Picture, PictureInfo, PictureWithTask} from "common/entities/picture"
import * as MimeTypes from "mime-types"
import {JsonFileList} from "common/entities/json_file_list"
import {config, discordApi, generationTaskDao, jsonFileLists, pictureDao, taskQueue, thumbnails, userDao, websocketServer} from "server/server_globals"
import {getHttpContext} from "server/context"

async function checkIsAdmin(): Promise<void> {
	userDao.checkIsAdmin(await userDao.getCurrent())
}

export namespace ServerApi {

	export const getGenerationParameterSets = RCV.validatedFunction(
		[],
		(): readonly GenerationParameterSet[] => {
			return [...config.parameterSets].map(paramSet => ({
				...paramSet,
				commandTemplate: ""
			}))
		})

	const Protocol = RC.constUnion(["http", "https"])
	export const getDiscordLoginUrl = RCV.validatedFunction(
		[RC.struct({protocol: Protocol, domain: RC.string()})],
		({protocol, domain}): string => {
			const str = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(config.discordClientId)}&redirect_uri=${encodeURIComponent(`${protocol}://${domain}/api/discordOauth2`)}&response_type=code&scope=identify`
			return str
		})

	export const discordOauth2 = RCV.validatedFunction(
		[RC.struct({code: RC.string()})],
		async({code}): Promise<void> => {
			const context = getHttpContext()
			const redirectUrl = new URL(context.requestUrl)
			redirectUrl.search = ""
			// why TF this works, but just `/` does not?
			// I don't understand this API
			redirectUrl.pathname = "/api/discordOauth2"

			const token = await discordApi.getTokenByCode(code, redirectUrl + "")
			const discordUser = await discordApi.getCurrentUser(token.access_token)
			let user = await userDao.queryByDiscordId(discordUser.id)
			if(user){
				userDao.setDiscordTokenProps(user, token)
				userDao.setDiscordUserProps(user, discordUser)
				await userDao.update(user)
			} else {
				const userWithoutId = userDao.makeEmptyUser()
				userDao.setDiscordTokenProps(userWithoutId, token)
				userDao.setDiscordUserProps(userWithoutId, discordUser)
				user = await userDao.create(userWithoutId)
			}

			userDao.setDiscordCookieToken(user)
			context.redirectUrl = "/"
		})

	export const getUserData = RCV.validatedFunction(
		[],
		async(): Promise<User> => {
			const user = await userDao.getCurrent()
			await userDao.maybeUpdateDiscordTokenProps(user)
			if(!user.discordAccessToken){
				throw new ApiError("not_logged_in", "User is not logged in.")
			}

			// it's not the best idea to do it here
			// but we should update this data at some point, right?
			const discordUser = await discordApi.getCurrentUser(user.discordAccessToken)
			userDao.setDiscordUserProps(user, discordUser)
			await userDao.update(user)

			userDao.setDiscordCookieToken(user)
			return userDao.stripUserForClient(user)
		})

	export const logout = RCV.validatedFunction(
		[],
		async(): Promise<void> => {
			const user = await userDao.getCurrent()
			userDao.clearLoginFields(user)
			await userDao.update(user)
			userDao.deleteDiscordCookieToken()
		})

	export const createGenerationTask = RCV.validatedFunction(
		[RC.struct({inputData: GenerationTaskInputData})],
		async({inputData}): Promise<GenerationTask> => {
			return await taskQueue.addToQueue(inputData)
		})

	export const listTasks = RCV.validatedFunction(
		[RC.struct({query: SimpleListQueryParams(GenerationTask)})],
		async({query}): Promise<GenerationTaskWithPictures[]> => {
			const currentUser = await userDao.getCurrent();
			(query.filters ||= []).push(
				{op: "=", a: {field: "userId"}, b: {value: currentUser.id}}
			)
			const tasks = await generationTaskDao.list(query)
			const result = await generationTaskDao.enrichWithPictures(tasks)
			for(const task of result){
				task.pictures.sort((a, b) => a.id - b.id)
				taskQueue.tryAddEstimatedDuration(task)
			}
			return result
		})

	export const getPictureData = RCV.validatedFunction(
		// actually number expected, string is for calling this stuff through HTTP GET
		[RC.struct({id: RC.union([RC.int(), RC.string()]), salt: RC.union([RC.int(), RC.string()])})],
		async({id, salt}): Promise<Buffer> => {
			const pictureId = typeof(id) === "string" ? parseInt(id) : id
			if(Number.isNaN(pictureId)){
				throw new ApiError("generic", "Bad picture ID: " + id)
			}

			const pictureSalt = typeof(salt) === "string" ? parseInt(salt) : salt
			if(Number.isNaN(pictureSalt)){
				throw new ApiError("generic", "Bad picture salt: " + salt)
			}

			const picture = await pictureDao.getById(pictureId)
			if(picture.salt !== pictureSalt){
				throw new ApiError("generic", "Wrong salt")
			}

			const picBytes = await pictureDao.getPictureData(picture)

			const ctx = getHttpContext()
			ctx.responseHeaders["Content-Type"] = MimeTypes.contentType("img." + picture.ext) || "image/jpeg"
			ctx.responseHeaders["Cache-Control"] = "public,max-age=31536000,immutable"

			return picBytes
		})

	export const getPictureThumbnails = RCV.validatedFunction(
		[RC.struct({idsAndSalts: RC.string()})],
		async({idsAndSalts: idsAndSaltsStr}): Promise<Buffer> => {

			function checkUint(x: unknown, name: string): asserts x is number {
				if(typeof(x) !== "number" || Number.isNaN(x) || x <= 0 || (x % 1) !== 0){
					throw new ApiError("validation_not_passed", `Incorrect ${name}.`)
				}
			}

			const idsAndSalts = idsAndSaltsStr.split("_").map(idAndSalt => {
				const [id, salt] = idAndSalt.split(".").map(x => parseInt(x))
				checkUint(id, "id")
				checkUint(salt, "salt")
				return {id, salt}
			})

			const unsortedPictures = await pictureDao.getByIds(idsAndSalts.map(x => x.id))
			const picturesMap = new Map(unsortedPictures.map(pic => [pic.id, pic]))
			const pictures = idsAndSalts.map(({id}) => picturesMap.get(id)!)
			const idSaltMap = new Map(idsAndSalts.map(({id, salt}) => [id, salt]))
			for(const picture of pictures){
				if(picture.salt !== idSaltMap.get(picture.id)){
					throw new ApiError("generic", `Bad picture salt for picture ${picture.id}`)
				}
			}

			const thumbsBytes = await Promise.all(pictures.map(pic => thumbnails.getThumbnail(pic)))
			const result = Buffer.alloc(thumbsBytes.map(bytes => bytes.length + 4).reduce((a, b) => a + b, 0))

			let offset = 0
			for(let i = 0; i < thumbsBytes.length; i++){
				let len = thumbsBytes[i]!.length
				for(let j = 0; j < 4; j++){
					result[offset++] = len & 0xff
					len >>= 8
				}
			}

			for(const bytes of thumbsBytes){
				bytes.copy(result, offset)
				offset += bytes.length
			}

			// it probably won't be as efficient as in single picture, but anyway
			const ctx = getHttpContext()
			ctx.responseHeaders["Content-Type"] = MimeTypes.contentType("img.webp") || "image/webp"
			ctx.responseHeaders["Cache-Control"] = "public,max-age=31536000,immutable"

			return result
		}
	)

	export const getPictureInfoById = RCV.validatedFunction(
		[RC.struct({id: RC.int(), salt: RC.int()})],
		async({id, salt}): Promise<Picture & PictureInfo> => {

			const picture = await pictureDao.getById(id)
			if(picture.salt !== salt){
				throw new ApiError("generic", "Wrong salt")
			}
			const info = await pictureDao.getPictureInfo(picture)
			const strippedPicture = pictureDao.stripServerData(picture)
			return {
				...strippedPicture,
				...info
			}
		})

	export const killOwnTask = RCV.validatedFunction(
		[RC.struct({id: RC.int()})],
		async({id}): Promise<void> => {
			const user = await userDao.getCurrent()
			await generationTaskDao.locks.withLock(id, async() => {
				await taskQueue.kill(id, user.id)
			})
		})

	export const uploadPictureAsArgument = RCV.validatedFunction(
		[RC.struct({paramSetName: RC.string(), paramName: RC.string(), fileName: RC.string(), data: RC.binary()})],
		async({paramSetName, paramName, fileName, data}): Promise<Picture & PictureInfo> => {
			if(!(data instanceof Buffer)){
				throw new Error("Data is not buffer!")
			}


			const {picture, info} = await pictureDao.uploadPictureAsArgumentAndValidate(paramSetName, paramName, fileName, data)
			return {...pictureDao.stripServerData(picture), ...info}
		})

	export const deleteTask = RCV.validatedFunction(
		[RC.struct({taskId: RC.int()})],
		async({taskId}): Promise<void> => {
			await generationTaskDao.locks.withLock(taskId, async() => {
				const [user, task] = await Promise.all([
					userDao.getCurrent(),
					generationTaskDao.getById(taskId)
				])
				if(task.userId !== user.id){
					throw new ApiError("validation_not_passed", `Task ${task.id} does not belong to user ${user.id}.`)
				}
				await generationTaskDao.delete(task)
			})
		}
	)

	export const adminListUsers = RCV.validatedFunction(
		[RC.struct({query: SimpleListQueryParams(User)})],
		async({query}): Promise<User[]> => {
			await checkIsAdmin()
			const users = await userDao.list(query)
			return users.map(user => userDao.stripUserForClient(user))
		}
	)

	export const adminUpdateUser = RCV.validatedFunction(
		[RC.struct({user: User})],
		async({user}): Promise<void> => {
			await checkIsAdmin()
			await userDao.update({
				...await userDao.getById(user.id),
				...user
			})
		}
	)

	export const getIsUserControlEnabled = RCV.validatedFunction(
		[],
		() => config.userControl
	)

	export const adminListTasks = RCV.validatedFunction(
		[RC.struct({query: SimpleListQueryParams(GenerationTask)})],
		async({query}): Promise<GenerationTask[]> => {
			await checkIsAdmin()
			return await generationTaskDao.list(query)
		}
	)

	export const adminKillTask = RCV.validatedFunction(
		[RC.struct({taskId: RC.int()})],
		async({taskId}): Promise<void> => {
			await checkIsAdmin()
			await generationTaskDao.locks.withLock(taskId, async() => {
				await taskQueue.kill(taskId, null)
			})
		}
	)

	export const adminKillAllQueuedTasks = RCV.validatedFunction(
		[],
		async(): Promise<void> => {
			await checkIsAdmin()
			await generationTaskDao.locks.withGlobalLock(async() => {
				await generationTaskDao.killAllQueued(null)
			})
		}
	)

	export const adminKillAllQueuedAndRunningTasks = RCV.validatedFunction(
		[],
		async(): Promise<void> => {
			await checkIsAdmin()
			await generationTaskDao.locks.withGlobalLock(async() => {
				await generationTaskDao.killAllQueuedAndRunning(null)
			})
		}
	)

	export const adminKillCurrentAndPauseQueue = RCV.validatedFunction(
		[],
		async(): Promise<void> => {
			await checkIsAdmin()
			taskQueue.pause()
			await generationTaskDao.locks.withGlobalLock(async() => {
				const runningTask = taskQueue.getRunningTaskId()
				if(runningTask !== null){
					await taskQueue.kill(runningTask, null)
				}
			})
		}
	)

	export const adminPauseQueue = RCV.validatedFunction(
		[],
		async(): Promise<void> => {
			await checkIsAdmin()
			taskQueue.pause()
		}
	)

	export const adminUnpauseQueue = RCV.validatedFunction(
		[],
		async(): Promise<void> => {
			await checkIsAdmin()
			taskQueue.unpause()
		}
	)

	export const adminReorderQueuedTasks = RCV.validatedFunction(
		[RC.struct({taskIds: RC.array(RC.number())})],
		async({taskIds}): Promise<{id: number, runOrder: number}[]> => {
			await checkIsAdmin()
			return await generationTaskDao.locks.withGlobalLock(async() => {
				// we need to check if the tasks that client thinks are queued are actually queued
				// this will help to avoid cases when already executing task is pushed back in queue
				// which doesn't make any sense
				let tasks = await generationTaskDao.getByIds(taskIds)
				tasks = tasks.filter(task => task.status === "queued")

				// higher value goes first, so lowest pops first
				const availableRunOrders = tasks.map(task => task.runOrder).sort((a, b) => b - a)
				const idSet = new Set(tasks.map(task => task.id))
				const pairs: [number, number][] = []
				for(const id of taskIds){
					if(!idSet.has(id)){
						continue // task is not queued
					}
					pairs.push([id, availableRunOrders.pop()!])
				}

				await generationTaskDao.updateMultipleFieldByCase("runOrder", pairs)

				const objPairs = pairs.map(([id, runOrder]) => ({id, runOrder}))

				// maybe some users shouldn't know about other users tasks here...?
				// but they still kinda know because run order is sequental
				// so, whatever
				websocketServer.sendToAll({type: "task_reordering", orderPairs: objPairs})

				return objPairs
			})
		}
	)

	export const getIsQueuePaused = RCV.validatedFunction(
		[],
		async(): Promise<boolean> => {
			return taskQueue.isPaused
		}
	)

	export const setPictureFavorite = RCV.validatedFunction(
		[RC.struct({pictureId: RC.number(), isFavorite: RC.bool()})],
		async({pictureId, isFavorite}): Promise<number | null> => {

			const [picture, user] = await Promise.all([
				pictureDao.getById(pictureId),
				userDao.getCurrent()
			])
			if(picture.ownerUserId !== user.id){
				throw new Error(`Picture ${picture.id} does not belong to user ${user.id}.`)
			}
			picture.favoritesAddTime = isFavorite ? Date.now() : null
			await pictureDao.update(picture)
			return picture.favoritesAddTime
		}
	)

	export const listPicturesWithTasks = RCV.validatedFunction(
		[RC.struct({query: SimpleListQueryParams(Picture)})],
		async({query}): Promise<PictureWithTask[]> => {

			const currentUser = await userDao.getCurrent();
			(query.filters ||= []).push(
				{op: "=", a: {field: "ownerUserId"}, b: {value: currentUser.id}},
			)
			const serverPictures = await pictureDao.list(query)
			const pictures = serverPictures.map(pic => pictureDao.stripServerData(pic) as PictureWithTask)

			const taskIds = [...new Set(pictures.map(x => x.generationTaskId))]
				.filter((x): x is number => x !== null)
			const tasks = await generationTaskDao.list({
				filters: [{
					a: {field: "id"},
					op: "in",
					b: {value: [...taskIds]}
				}]
			})
			const taskMap = new Map(tasks.map(task => [task.id, task]))

			for(const picture of pictures){
				const task = taskMap.get(picture.generationTaskId ?? -1)
				if(!task){
					throw new ApiError("generic", `Task #${picture.generationTaskId} not found for picture #${picture.id}`)
				}

				picture.task = task
			}

			return pictures
		}
	)

	export const getAllJsonFileLists = RCV.validatedFunction(
		[],
		async(): Promise<readonly JsonFileList[]> => {
			return jsonFileLists.getAllLists()
		}
	)

	export const deletePicture = RCV.validatedFunction(
		[RC.struct({pictureId: RC.number()})],
		async({pictureId}): Promise<void> => {
			const [picture, user] = await Promise.all([
				pictureDao.getById(pictureId),
				userDao.getCurrent()
			])
			if(picture.ownerUserId !== user.id){
				throw new Error(`Picture ${picture.id} does not belong to user ${user.id}.`)
			}

			await pictureDao.delete(picture)
		}
	)

	export const setTaskNote = RCV.validatedFunction(
		[RC.struct({taskId: RC.number(), note: RC.string()})],
		async({taskId, note}): Promise<void> => {
			await generationTaskDao.locks.withLock(taskId, async() => {
				const [task, user] = await Promise.all([
					generationTaskDao.getById(taskId),
					userDao.getCurrent()
				])

				if(task.userId !== user.id){
					throw new Error(`Task ${task.id} does not belong to user ${user.id}.`)
				}

				task.note = note
				await generationTaskDao.update(task)
			})
		}
	)

	export const searchTasks = RCV.validatedFunction(
		[RC.struct({
			query: RC.string(),
			minKnownTaskId: RC.union([RC.constant(null), RC.number()]),
			pageSize: RC.number()
		})],
		async({query, pageSize, minKnownTaskId}): Promise<GenerationTaskWithPictures[]> => {
			const user = await userDao.getCurrent()
			const tasks = await generationTaskDao.search(query, pageSize, user.id, minKnownTaskId)
			const tasksWithPictures = await generationTaskDao.enrichWithPictures(tasks)
			return tasksWithPictures
		}
	)

}