import {GenerationTask, GenerationTaskInputData} from "common/entities/generation_task"
import {ApiError} from "common/infra_entities/api_error"
import {ApiNotification} from "common/infra_entities/notifications"
import {ServerGenerationTaskInputData} from "server/entities/generation_task_dao"
import {assertIsPictureType} from "server/entities/picture_dao"
import {GenRunner, GenRunnerCallbacks} from "server/gen_runner"
import {log, runInCatchLog, wrapInCatchLog} from "server/log"
import {DebouncedCollector, makeDebounceCollector} from "server/utils/debounce_collect"
import {unixtime} from "server/utils/unixtime"
import * as Path from "path"
import {promises as Fs} from "fs"
import {ServerPicture} from "server/entities/picture_dao"
import {runWithMinimalContext} from "server/context"
import {config, context, generationTaskDao, pictureDao, userDao, websocketServer} from "server/server_globals"

export class TaskQueueController {
	readonly name = "Task queue"

	private runningGeneration: {
		gen: GenRunner
		input: ServerGenerationTaskInputData
		estimatedDuration: number | null
	} | null = null
	private generationIsStarting = false
	private queueIsMoving = false

	async start(): Promise<void> {
		this.queueIsMoving = true
		await runWithMinimalContext(async() => {
			const runningTask = await generationTaskDao.queryRunning()
			if(runningTask){
				log(`Discovered that task #${runningTask} is running in DB, but we are just started and could not possibly start a task. Marking it as completed, because not much we can do at this point.`)
				runningTask.status = "completed"
				await generationTaskDao.update(runningTask)
			}
		})

		this.tryStartNextGeneration()
	}

	async kill(id: number, userId: number | null): Promise<void> {
		if(this.runningGeneration && this.runningGeneration.gen.task.id === id){
			if(userId !== null && this.runningGeneration.gen.task.userId !== userId){
				throw new ApiError("validation_not_passed", `Task ${id} does not belong to user ${userId}`)
			}
			log(`Killing running task #${id}.`)
			this.runningGeneration.gen.kill()
			this.tryStartNextGeneration()
			return
		} else {
			const task = await generationTaskDao.getById(id)
			if(userId !== null && task.userId !== userId){
				throw new ApiError("validation_not_passed", `Task ${id} does not belong to user ${userId}`)
			}
			log(`Removing task #${id} from queue.`)
			task.status = "completed"
			task.finishTime = unixtime()
			sendTaskUpdate(task, {
				type: "task_finished",
				taskId: task.id,
				finishTime: task.finishTime
			})
			await generationTaskDao.update(task)
		}
	}

	async addToQueue(inputData: GenerationTaskInputData): Promise<GenerationTask> {
		await generationTaskDao.validateInputData(inputData)

		const user = await userDao.getCurrent()
		const genTask: Omit<GenerationTask, "id"> = {
			...inputData,
			userId: user.id,
			creationTime: unixtime(),
			expectedPictures: null,
			startTime: null,
			finishTime: null,
			generatedPictures: 0,
			status: "queued",
			runOrder: -1,
			exitCode: 0
		}

		const result = await generationTaskDao.create(genTask)
		log("Enqueued task #" + result.id)

		sendTaskUpdate(result, {
			type: "task_created",
			task: result
		})

		// just to make queue more uniform
		context.get().onClosed.push(() => {
			this.tryStartNextGeneration()
		})

		return result
	}

	// this method can be called without await
	private async tryStartNextGeneration(): Promise<void> {
		if(!this.shouldTryRunGeneration()){
			return
		}
		try {
			const res = await runWithMinimalContext(async() => {
				const nextTask = await generationTaskDao.getNextInQueue()
				if(!nextTask){
					return null
				} else {
					return nextTask
				}
			})
			if(!res){
				log("Task queue is empty.")
				return
			}
			await this.tryStartGeneration(res)
		} catch(e){
			log("Failed to run generation: " + e)
		}
		try {
			await this.waitGenerationEnd()
		} finally {
			this.runningGeneration = null
		}
		await this.tryStartNextGeneration()
	}

	private async waitGenerationEnd(): Promise<void> {
		if(this.runningGeneration){
			await this.runningGeneration.gen.waitCompletion()
		}
	}

	private shouldTryRunGeneration(): boolean {
		return !this.runningGeneration && !this.generationIsStarting && this.queueIsMoving
	}

	private async tryStartGeneration(task: GenerationTask): Promise<void> {
		if(!this.shouldTryRunGeneration()){
			return
		}
		this.generationIsStarting = true
		try {
			log(`Starting generation for task #${task.id}`)

			const [update, sendTaskNotification, callbacks] = this.makeTaskCallbacks(task)

			const preparedInputData = await runWithMinimalContext(async() => {
				return await generationTaskDao.prepareInputData(task)
			})
			const gen = new GenRunner(config, callbacks, preparedInputData, task)
			this.runningGeneration = {gen, input: preparedInputData, estimatedDuration: null}

			const startTime = unixtime()
			update(() => {
				task.status = "running"
				task.startTime = startTime
			})
			sendTaskNotification({
				type: "task_started",
				taskId: task.id,
				startTime: startTime
			})

			const exitResult = await gen.waitCompletion()

			log(`Task #${task.id} completed`)
			const finishTime = unixtime()
			update(() => {
				task.status = "completed"
				task.finishTime = finishTime
				task.exitCode = exitResult.code
			})
			sendTaskNotification({
				type: "task_finished",
				taskId: task.id,
				finishTime: finishTime
			})

			await generationTaskDao.cleanupInputData(preparedInputData)
			await update.waitInvocationsOver()
			runWithMinimalContext(() => pictureDao.tryCleanupExcessivePicturesOfUser(task.userId))
		} finally {
			this.generationIsStarting = false
			this.runningGeneration = null
		}
	}

	pause(): void {
		this.queueIsMoving = false
	}

	unpause(): void {
		this.queueIsMoving = true
		this.tryStartNextGeneration()
	}

	get isPaused(): boolean {
		return !this.queueIsMoving
	}

	async stop(): Promise<void> {
		this.queueIsMoving = false
		if(this.runningGeneration){
			this.runningGeneration.gen.process.kill()
		}
		await this.waitGenerationEnd()
	}

	private makeTaskCallbacks(task: GenerationTask): [
		DebouncedCollector<() => void>,
		(notification: ApiNotification) => void,
		GenRunnerCallbacks
	] {
		const update = makeDebounceCollector<(afterUpdateActions: (() => void)[]) => void>(500, updaters => {
			runInCatchLog(() => runWithMinimalContext(async ctx => {
				const afterUpdateActions: (() => void)[] = []
				const taskBeforeUpdate = JSON.stringify(task)
				for(const updater of updaters){
					await runInCatchLog(() => updater(afterUpdateActions))
				}
				if(JSON.stringify(task) !== taskBeforeUpdate){
					await generationTaskDao.update(task)
					await ctx.db.flushTransaction()
				}
				// afterUpdateActions is mainly intended for notifications sending
				// and we flush transaction before notifications are sent
				// because otherwise there's a chance that transaction won't be commited before frontend knows about the change
				// and that's bad, because frontend is then able to query data that is not in db yet
				for(const action of afterUpdateActions){
					runInCatchLog(() => action())
				}
			}))
		})

		function sendTaskNotification(body: ApiNotification): void {
			update(actions => actions.push(() => {
				sendTaskUpdate(task, body)
			}))
		}

		const callbacks: GenRunnerCallbacks = {

			onErrorMessage: (msg, displayFor) => {
				log(`Task #${task.id} produced error message: ${msg}`)
				sendTaskNotification({
					type: "task_message",
					messageType: "error",
					message: msg,
					taskId: task.id,
					displayFor
				})
			},

			onMessage: (msg, displayFor) => {
				log(`Task #${task.id} produced message: ${msg}`)
				sendTaskNotification({
					type: "task_message",
					messageType: "info",
					message: msg,
					taskId: task.id,
					displayFor
				})
			},

			onExpectedPictureCountKnown: count => {
				update(() => task.expectedPictures = count)
				sendTaskNotification({
					type: "task_expected_picture_count_known",
					taskId: task.id,
					expectedPictureCount: count
				})
			},

			onFileProduced: (path, modifiedArguments) => update(async() => {
				const ext = Path.extname(path).substring(1).toLowerCase()
				assertIsPictureType(ext)
				let serverPic: ServerPicture
				switch(config.resultingPictureReceivingStrategy){
					case "copy": {
						const content = await Fs.readFile(path)
						serverPic = await pictureDao.storeGeneratedPictureByContent(content, task, task.generatedPictures, ext, modifiedArguments)
						break
					}
					case "move": {
						const content = await Fs.readFile(path)
						serverPic = await pictureDao.storeGeneratedPictureByContent(content, task, task.generatedPictures, ext, modifiedArguments)
						await Fs.rm(path)
						break
					}
					case "refer": {
						serverPic = await pictureDao.storeGeneratedPictureByPathReference(path, task, task.generatedPictures, ext, modifiedArguments)
						break
					}
				}
				task.generatedPictures++
				sendTaskNotification({
					type: "task_generated_picture",
					taskId: task.id,
					picture: pictureDao.stripServerData(serverPic),
					generatedPictures: task.generatedPictures
				})
			}),

			onTaskArgumentsModified: args => {
				update(() => task.arguments = {...task.arguments, ...args})
				sendTaskNotification({
					type: "task_arguments_updated",
					taskId: task.id,
					args
				})
			},

			onTimeLeftKnown: timeLeft => {
				const timePassed = unixtime() - (task.startTime ?? unixtime())
				const duration = timePassed + timeLeft

				if(this.runningGeneration){
					this.runningGeneration.estimatedDuration = duration
				}

				sendTaskNotification({
					type: "task_estimated_duration_known",
					taskId: task.id,
					estimatedDuration: duration
				})
			}
		}

		return [update, sendTaskNotification, this.wrapCallbacks(callbacks)]
	}

	private wrapCallbacks(callbacks: GenRunnerCallbacks): GenRunnerCallbacks {
		const result = {} as Partial<GenRunnerCallbacks>
		for(const name in callbacks){
			const callbackFn = callbacks[name as keyof GenRunnerCallbacks]
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			result[name as keyof GenRunnerCallbacks] = wrapInCatchLog(callbackFn as any) as any // argh!
		}
		return result as GenRunnerCallbacks
	}

	getEstimatedDurationForTask(taskId: number): number | null {
		if(this.runningGeneration && this.runningGeneration.gen.task.id === taskId){
			return this.runningGeneration.estimatedDuration
		}
		return null
	}

	tryAddEstimatedDuration(task: GenerationTask): void {
		// all this stuff is required because I don't want to store estimated duration in database
		// it will require a column for a value that is basically never used unless task is running
		// so it's more efficient to just keep this one value in memory
		const duration = this.getEstimatedDurationForTask(task.id)
		if(duration !== null){
			task.estimatedDuration = duration
		}
	}

}

function sendTaskUpdate(task: GenerationTask, update: ApiNotification): void {
	websocketServer.sendToUser(task.userId, update)
	websocketServer.sendByCriteria(conn => conn.data.user.isAdmin, {type: "task_admin_notification", task})
}