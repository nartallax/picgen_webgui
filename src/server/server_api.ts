import {ApiError} from "common/infra_entities/api_error"
import {cont} from "server/async_context"
import {config} from "server/config"
import {RC} from "@nartallax/ribcage"
import {RCV} from "@nartallax/ribcage-validation"
import {GenerationParameterSet} from "common/entities/parameter"
import {User} from "common/entities/user"
import {GenerationTask, GenerationTaskInputData, GenerationTaskWithPictures} from "common/entities/generation_task"
import {SimpleListQueryParams} from "common/infra_entities/query"
import {Picture, PictureInfo, PictureWithTask} from "common/entities/picture"
import * as MimeTypes from "mime-types"
import {RequestContext} from "server/request_context"
import {unixtime} from "server/utils/unixtime"
import {LoraDescription} from "common/entities/lora"

async function adminCont(): Promise<RequestContext> {
	const context = cont()
	context.user.checkIsAdmin(await context.user.getCurrent())
	return context
}

export namespace ServerApi {

	export const getGenerationParameterSets = RCV.validatedFunction(
		[],
		(): readonly GenerationParameterSet[] => {
			return config.parameterSets
		})

	export const getShapeTags = RCV.validatedFunction(
		[],
		(): readonly string[] => {
			return config.tags.shape
		})

	export const getContentTags = RCV.validatedFunction(
		[],
		(): {readonly [tagContent: string]: readonly string[]} => {
			return config.tags.content
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
			const context = cont()
			const redirectUrl = new URL(context.requestUrl)
			redirectUrl.search = ""
			// why TF this works, but just `/` does not?
			// I don't understand this API
			redirectUrl.pathname = "/api/discordOauth2"

			const token = await context.discordApi.getTokenByCode(code, redirectUrl + "")
			const discordUser = await context.discordApi.getCurrentUser(token.access_token)
			let user = await context.user.queryByDiscordId(discordUser.id)
			if(user){
				context.user.setDiscordTokenProps(user, token)
				context.user.setDiscordUserProps(user, discordUser)
				await context.user.update(user)
			} else {
				const userWithoutId = context.user.makeEmptyUser()
				context.user.setDiscordTokenProps(userWithoutId, token)
				context.user.setDiscordUserProps(userWithoutId, discordUser)
				user = await context.user.create(userWithoutId)
			}

			context.user.setDiscordCookieToken(user)
			context.redirectUrl = "/"
		})

	export const getUserData = RCV.validatedFunction(
		[],
		async(): Promise<User> => {
			const context = cont()
			const user = await context.user.getCurrent()
			await context.user.maybeUpdateDiscordTokenProps(user)
			if(!user.discordAccessToken){
				throw new ApiError("not_logged_in", "User is not logged in.")
			}

			// it's not the best idea to do it here
			// but we should update this data at some point, right?
			const discordUser = await context.discordApi.getCurrentUser(user.discordAccessToken)
			context.user.setDiscordUserProps(user, discordUser)
			await context.user.update(user)

			context.user.setDiscordCookieToken(user)
			return context.user.stripUserForClient(user)
		})

	export const logout = RCV.validatedFunction(
		[],
		async(): Promise<void> => {
			const context = cont()
			const user = await context.user.getCurrent()
			context.user.clearLoginFields(user)
			await context.user.update(user)
			context.user.deleteDiscordCookieToken()
		})

	export const createGenerationTask = RCV.validatedFunction(
		[RC.struct({inputData: GenerationTaskInputData})],
		async({inputData}): Promise<GenerationTask> => {
			return await cont().taskQueue.addToQueue(inputData)
		})

	export const listTasks = RCV.validatedFunction(
		[RC.struct({query: SimpleListQueryParams(GenerationTask)})],
		async({query}): Promise<GenerationTaskWithPictures[]> => {
			const context = cont()
			const currentUser = await context.user.getCurrent();
			(query.filters ||= []).push(
				{op: "=", a: {field: "userId"}, b: {value: currentUser.id}}
			)
			const tasks = await context.generationTask.list(query)
			const serverPictures = await context.picture.queryAllFieldIncludes("generationTaskId", tasks.map(x => x.id))
			const pictures = serverPictures.map(pic => context.picture.stripServerData(pic))
			const taskMap = new Map<number, GenerationTaskWithPictures>(tasks.map(task => [task.id, {...task, pictures: []}]))
			for(const picture of pictures){
				const task = taskMap.get(picture.generationTaskId!)!
				task.pictures.push(picture)
			}
			const result = [...taskMap.values()]
			for(const task of result){
				task.pictures.sort((a, b) => a.id - b.id)
				context.taskQueue.tryAddEstimatedDuration(task)
			}
			return result
		})

	export const getPictureData = RCV.validatedFunction(
		// actually number expected, string is for calling this stuff through HTTP GET
		[RC.struct({id: RC.union([RC.int(), RC.string()]), salt: RC.union([RC.int(), RC.string()])})],
		async({id, salt}): Promise<Buffer> => {
			const context = cont()

			const pictureId = typeof(id) === "string" ? parseInt(id) : id
			if(Number.isNaN(pictureId)){
				throw new ApiError("generic", "Bad picture ID: " + id)
			}

			const pictureSalt = typeof(salt) === "string" ? parseInt(salt) : salt
			if(Number.isNaN(pictureSalt)){
				throw new ApiError("generic", "Bad picture salt: " + salt)
			}

			const picture = await context.picture.getById(pictureId)
			if(picture.salt !== pictureSalt){
				throw new ApiError("generic", "Wrong salt")
			}

			context.responseHeaders["Content-Type"] = MimeTypes.contentType("img." + picture.ext) || "image/jpeg"
			context.responseHeaders["Cache-Control"] = "public,max-age=31536000,immutable"

			// TODO: stream directly into http stream?
			const result = await context.picture.getPictureData(picture)
			return result
		})

	export const getPictureInfoById = RCV.validatedFunction(
		[RC.struct({id: RC.int(), salt: RC.int()})],
		async({id, salt}): Promise<Picture & PictureInfo> => {
			const context = cont()
			const picture = await context.picture.getById(id)
			if(picture.salt !== salt){
				throw new ApiError("generic", "Wrong salt")
			}
			const info = await context.picture.getPictureInfo(picture)
			const strippedPicture = context.picture.stripServerData(picture)
			return {
				...strippedPicture,
				...info
			}
		})

	export const killOwnTask = RCV.validatedFunction(
		[RC.struct({id: RC.int()})],
		async({id}): Promise<void> => {
			const context = cont()
			const user = await context.user.getCurrent()
			await context.taskQueue.kill(id, user.id)
		})

	export const uploadPictureAsArgument = RCV.validatedFunction(
		[RC.struct({paramSetName: RC.string(), paramName: RC.string(), fileName: RC.string(), data: RC.binary()})],
		async({paramSetName, paramName, fileName, data}): Promise<Picture> => {
			if(!(data instanceof Buffer)){
				throw new Error("Data is not buffer!")
			}

			const context = cont()
			const pic = await context.picture.uploadPictureAsArgumentAndValidate(paramSetName, paramName, fileName, data)
			return context.picture.stripServerData(pic)
		})

	export const deleteTask = RCV.validatedFunction(
		[RC.struct({taskId: RC.int()})],
		async({taskId}): Promise<void> => {
			const context = cont()
			const [user, task] = await Promise.all([
				context.user.getCurrent(),
				context.generationTask.getById(taskId)
			])
			if(task.userId !== user.id){
				throw new ApiError("validation_not_passed", `Task ${task.id} does not belong to user ${user.id}.`)
			}
			await context.generationTask.delete(task)
		}
	)

	export const adminListUsers = RCV.validatedFunction(
		[RC.struct({query: SimpleListQueryParams(User)})],
		async({query}): Promise<User[]> => {
			const context = await adminCont()
			const users = await context.user.list(query)
			return users.map(user => context.user.stripUserForClient(user))
		}
	)

	export const adminUpdateUser = RCV.validatedFunction(
		[RC.struct({user: User})],
		async({user}): Promise<void> => {
			const context = await adminCont()
			await context.user.update({
				...await context.user.getById(user.id),
				...user
			})
		}
	)

	export const getIsUserControlEnabled = RCV.validatedFunction(
		[],
		() => cont().config.userControl
	)

	export const adminListTasks = RCV.validatedFunction(
		[RC.struct({query: SimpleListQueryParams(GenerationTask)})],
		async({query}): Promise<GenerationTask[]> => {
			const context = await adminCont()
			return await context.generationTask.list(query)
		}
	)

	export const adminKillTask = RCV.validatedFunction(
		[RC.struct({taskId: RC.int()})],
		async({taskId}): Promise<void> => {
			const context = await adminCont()
			await context.taskQueue.kill(taskId, null)
		}
	)

	export const adminKillAllQueuedTasks = RCV.validatedFunction(
		[],
		async(): Promise<void> => {
			const context = await adminCont()
			await context.generationTask.killAllQueued(null)
		}
	)

	export const adminKillAllQueuedAndRunningTasks = RCV.validatedFunction(
		[],
		async(): Promise<void> => {
			const context = await adminCont()
			await context.generationTask.killAllQueuedAndRunning(null)
		}
	)

	export const adminPauseQueue = RCV.validatedFunction(
		[],
		async(): Promise<void> => {
			const context = await adminCont()
			context.taskQueue.pause()
		}
	)

	export const adminUnpauseQueue = RCV.validatedFunction(
		[],
		async(): Promise<void> => {
			const context = await adminCont()
			context.taskQueue.unpause()
		}
	)

	export const getIsQueuePaused = RCV.validatedFunction(
		[],
		async(): Promise<boolean> => {
			const context = cont()
			return context.taskQueue.isPaused
		}
	)

	export const setPictureFavorite = RCV.validatedFunction(
		[RC.struct({pictureId: RC.number(), isFavorite: RC.bool()})],
		async({pictureId, isFavorite}): Promise<number | null> => {
			const context = cont()
			const [picture, user] = await Promise.all([
				context.picture.getById(pictureId),
				context.user.getCurrent()
			])
			if(picture.ownerUserId !== user.id){
				throw new Error(`Picture ${picture.id} does not belong to user ${user.id}.`)
			}
			picture.favoritesAddTime = isFavorite ? unixtime() : null
			context.picture.update(picture)
			return picture.favoritesAddTime
		}
	)

	export const listPicturesWithTasks = RCV.validatedFunction(
		[RC.struct({query: SimpleListQueryParams(Picture)})],
		async({query}): Promise<PictureWithTask[]> => {
			const context = cont()
			const currentUser = await context.user.getCurrent();
			(query.filters ||= []).push(
				{op: "=", a: {field: "ownerUserId"}, b: {value: currentUser.id}},
			)
			const serverPictures = await context.picture.list(query)
			const pictures = serverPictures.map(pic => context.picture.stripServerData(pic) as PictureWithTask)

			const taskIds = [...new Set(pictures.map(x => x.generationTaskId))]
				.filter((x): x is number => x !== null)
			const tasks = await context.generationTask.list({
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

	export const getAvailableLoras = RCV.validatedFunction(
		[],
		async(): Promise<readonly LoraDescription[]> => {
			return cont().lora.getLoras()
		}
	)

}