import {ApiError} from "common/infra_entities/api_error"
import {cont} from "server/async_context"
import {config} from "server/config"
import {RC} from "@nartallax/ribcage"
import {RCV} from "@nartallax/ribcage-validation"
import {GenerationParameterSet} from "common/entities/parameter"
import {User} from "common/entities/user"
import {GenerationTask, GenerationTaskInputData, GenerationTaskWithPictures} from "common/entities/generation_task"
import {SimpleListQueryParams} from "common/infra_entities/query"
import {Picture, PictureInfo} from "common/entities/picture"
import * as MimeTypes from "mime-types"

export namespace ServerApi {

	export const getGenerationParameterSets = RCV.validatedFunction(
		[] as const,
		(): readonly GenerationParameterSet[] => {
			return config.parameterSets
		})

	export const getShapeTags = RCV.validatedFunction(
		[] as const,
		(): readonly string[] => {
			return config.tags.shape
		})

	export const getContentTags = RCV.validatedFunction(
		[] as const,
		(): {readonly [tagContent: string]: readonly string[]} => {
			return config.tags.content
		})

	const Protocol = RC.union([RC.constant("http" as const), RC.constant("https" as const)])
	export const getDiscordLoginUrl = RCV.validatedFunction(
		[RC.struct({protocol: Protocol, domain: RC.string()})] as const,
		({protocol, domain}): string => {
			const str = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(config.discordClientId)}&redirect_uri=${encodeURIComponent(`${protocol}://${domain}/api/discordOauth2`)}&response_type=code&scope=identify`
			return str
		})

	export const discordOauth2 = RCV.validatedFunction(
		[RC.struct({code: RC.string()})] as const,
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
		[] as const,
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
		[] as const,
		async(): Promise<void> => {
			const context = cont()
			const user = await context.user.getCurrent()
			context.user.clearLoginFields(user)
			await context.user.update(user)
			context.user.deleteDiscordCookieToken()
		})

	export const createGenerationTask = RCV.validatedFunction(
		[RC.struct({inputData: GenerationTaskInputData})] as const,
		async({inputData}): Promise<GenerationTask> => {
			return await cont().taskQueue.addToQueue(inputData)
		})

	export const listTasks = RCV.validatedFunction(
		[RC.struct({query: SimpleListQueryParams(GenerationTask)})] as const,
		async({query}): Promise<GenerationTaskWithPictures[]> => {
			const context = cont()
			const currentUser = await context.user.getCurrent();
			(query.filters ||= []).push(
				{op: "=", a: {field: "userId"}, b: {value: currentUser.id}},
				{op: "=", a: {field: "hidden"}, b: {value: false}}
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
				task.pictures.sort((a, b) => a.creationTime - b.creationTime)
			}
			return result
		})

	export const getPictureData = RCV.validatedFunction(
		// actually number expected, string is for calling this stuff through HTTP GET
		[RC.struct({id: RC.union([RC.int(), RC.string()]), salt: RC.union([RC.int(), RC.string()])})] as const,
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
		[RC.struct({id: RC.int(), salt: RC.int()})] as const,
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
		[RC.struct({id: RC.int()})] as const,
		async({id}): Promise<void> => {
			const context = cont()
			const user = await context.user.getCurrent()
			await context.taskQueue.kill(id, user.id)
		})

	export const uploadPictureAsArgument = RCV.validatedFunction(
		[RC.struct({paramSetName: RC.string(), paramName: RC.string(), fileName: RC.string(), data: RC.binary()})] as const,
		async({paramSetName, paramName, fileName, data}): Promise<Picture> => {
			if(!(data instanceof Buffer)){
				throw new Error("Data is not buffer!")
			}

			const context = cont()
			const pic = await context.picture.uploadPictureAsArgumentAndValidate(paramSetName, paramName, fileName, data)
			return context.picture.stripServerData(pic)
		})

	export const hideTask = RCV.validatedFunction(
		[RC.struct({taskId: RC.int()})] as const,
		async({taskId}): Promise<void> => {
			const context = cont()
			const [user, task] = await Promise.all([
				context.user.getCurrent(),
				context.generationTask.getById(taskId)
			])
			if(task.userId !== user.id){
				throw new ApiError("validation_not_passed", `Task ${task.id} does not belong to user ${user.id}.`)
			}
			task.hidden = true
			context.generationTask.update(task)
		}
	)

	export const adminListUsers = RCV.validatedFunction(
		[RC.struct({query: SimpleListQueryParams(User)})] as const,
		async({query}): Promise<User[]> => {
			const context = cont()
			context.user.checkIsAdmin(await context.user.getCurrent())
			const users = await context.user.list(query)
			return users.map(user => context.user.stripUserForClient(user))
		}
	)

	export const adminUpdateUser = RCV.validatedFunction(
		[RC.struct({user: User})] as const,
		async({user}): Promise<void> => {
			const context = cont()
			context.user.checkIsAdmin(await context.user.getCurrent())
			await context.user.update({
				...await context.user.getById(user.id),
				...user
			})
		}
	)

	export const getIsUserControlEnabled = RCV.validatedFunction(
		[] as const,
		() => cont().config.userControl
	)

}