import {ApiNotification} from "common/common_types"
import {GenerationTask, GenerationTaskInputData} from "common/entity_types"
import {cont} from "server/async_context"
import {Config} from "server/config"
import {ServerGenerationTaskInputData} from "server/entities/generation_task"
import {assertIsPictureType} from "server/entities/picture"
import {GenRunner, GenRunnerCallbacks} from "server/gen_runner"
import {log, runInCatchLog, wrapInCatchLog} from "server/log"
import {UserlessContext, UserlessContextFactory} from "server/request_context"
import {DebouncedCollector, makeDebounceCollector} from "server/utils/debounce_collect"
import {unixtime} from "server/utils/unixtime"

export class TaskQueueController {

	private runningGeneration: {gen: GenRunner, input: ServerGenerationTaskInputData} | null = null
	private queueIsMoving = false

	constructor(private readonly contextFactory: UserlessContextFactory) {}

	async init(): Promise<void> {
		this.queueIsMoving = true
		await this.contextFactory(async context => {
			await context.picture.init()
			const runningTask = await context.generationTask.getRunning()
			if(runningTask){
				log(`Discovered that task #${runningTask} is running in DB, but we are just started and could not possibly start a task. Marking it as completed, because not much we can do at this point.`)
				runningTask.status = "completed"
				await context.generationTask.update(runningTask)
			}
		})

		this.tryStartNextGeneration() // yep, without await. intended.
	}

	async kill(id: number): Promise<void> {
		if(this.runningGeneration && this.runningGeneration.gen.task.id === id){
			log(`Killing running task #${id}.`)
			this.runningGeneration.gen.kill()
			this.tryStartNextGeneration()
			return
		} else {
			log(`Removing task #${id} from queue.`)
			const context = cont()
			const task = await context.generationTask.getById(id)
			task.status = "completed"
			task.finishTime = unixtime()
			context.websockets.sendNotificationToAll({
				type: "task_finished",
				taskId: task.id,
				finishTime: task.finishTime
			})
			await context.generationTask.update(task)
		}
	}

	async addToQueue(inputData: GenerationTaskInputData): Promise<GenerationTask> {
		const context = cont()

		await context.generationTask.validateInputData(inputData)

		const user = await context.user.getCurrent()
		const genTask: Omit<GenerationTask, "id"> = {
			...inputData,
			userId: user.id,
			creationTime: unixtime(),
			expectedPictures: null,
			startTime: null,
			finishTime: null,
			generatedPictures: 0,
			status: "queued",
			runOrder: -1
		}

		// TODO: fix runOrder here? after creation
		const result = await context.generationTask.create(genTask)
		log("Enqueued task #" + result.id)

		context.websockets.sendNotificationToAll({
			type: "task_created",
			task: result
		})

		// just to make queue more uniform
		context.onClosed(() => this.tryStartNextGeneration())

		return result
	}

	private async tryStartNextGeneration(): Promise<void> {
		if(!this.shouldTryRunGeneration()){
			return
		}
		try {
			const res = await this.contextFactory(async context => {
				const nextTask = await context.generationTask.getNextInQueue()
				if(!nextTask){
					return null
				} else {
					return {nextTask, config: context.config}
				}
			})
			if(!res){
				log("Task queue is empty.")
				return
			}
			await this.tryStartGeneration(res.config, res.nextTask)
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

	private waitGenerationEnd(): Promise<void> {
		return !this.runningGeneration ? Promise.resolve() : this.runningGeneration.gen.waitCompletion()
	}

	private shouldTryRunGeneration(): boolean {
		return !this.runningGeneration && this.queueIsMoving
	}

	private async tryStartGeneration(config: Config, task: GenerationTask): Promise<void> {
		if(!this.shouldTryRunGeneration()){
			return
		}
		log(`Starting generation for task #${task.id}`)

		const [update, sendTaskNotification, callbacks] = this.makeTaskCallbacks(task)

		const preparedInputData = await this.contextFactory(async context => {
			return await context.generationTask.prepareInputData(task)
		})
		const gen = new GenRunner(config, callbacks, preparedInputData, task)
		this.runningGeneration = {gen, input: preparedInputData}

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

		await gen.waitCompletion()

		log(`Task #${task.id} completed`)
		const finishTime = unixtime()
		update(() => {
			task.status = "completed"
			task.finishTime = finishTime
		})
		sendTaskNotification({
			type: "task_finished",
			taskId: task.id,
			finishTime: finishTime
		})

		this.contextFactory(context => {
			context.generationTask.cleanupInputData(preparedInputData)
		})
		await update.waitInvocationsOver()
		this.runningGeneration = null
	}

	async stop(): Promise<void> {
		this.queueIsMoving = false
		if(this.runningGeneration){
			this.runningGeneration.gen.process.kill()
		}
		await this.waitGenerationEnd()
	}

	private makeTaskCallbacks(task: GenerationTask): [
		DebouncedCollector<(context: UserlessContext) => void>,
		(notification: ApiNotification) => void,
		GenRunnerCallbacks
	] {
		const update = makeDebounceCollector<(context: UserlessContext, afterUpdateActions: ((context: UserlessContext) => void)[]) => void>(500, updaters => {
			runInCatchLog(() => this.contextFactory(async context => {
				const afterUpdateActions: ((context: UserlessContext) => void)[] = []
				const taskBeforeUpdate = JSON.stringify(task)
				for(const updater of updaters){
					await runInCatchLog(() => updater(context, afterUpdateActions))
				}
				if(JSON.stringify(task) !== taskBeforeUpdate){
					await context.generationTask.update(task)
					await context.db.flushTransaction()
				}
				// afterUpdateActions is mainly intended for notifications sending
				// and we flush transaction before notifications are sent
				// because otherwise there's a chance that transaction won't be commited before frontend knows about the change
				// and that's bad, because frontend is then able to query data that is not in db yet
				for(const action of afterUpdateActions){
					runInCatchLog(() => action(context))
				}
			}))
		})

		function sendTaskNotification(body: ApiNotification): void {
			update((_, actions) => actions.push(context => {
				context.websockets.sendNotificationToUser(task.userId, body)
			}))
		}

		const callbacks: GenRunnerCallbacks = {

			onErrorMessage: msg => {
				log(`Task #${task.id} produced error message: ${msg}`)
				sendTaskNotification({
					type: "task_message",
					messageType: "error",
					message: msg,
					taskId: task.id
				})
			},

			onMessage: msg => {
				log(`Task #${task.id} produced message: ${msg}`)
				sendTaskNotification({
					type: "task_message",
					messageType: "info",
					message: msg,
					taskId: task.id
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

			onFileProduced: (data, ext) => update(async context => {
				assertIsPictureType(ext)
				task.generatedPictures++
				const serverPic = await context.picture.storeGeneratedPicture(data, task, task.generatedPictures, ext)
				sendTaskNotification({
					type: "task_generated_picture",
					taskId: task.id,
					picture: context.picture.stripServerData(serverPic),
					generatedPictures: task.generatedPictures
				})
			}),

			onPromptUpdated: prompt => {
				update(() => task.prompt = prompt)
				sendTaskNotification({
					type: "task_prompt_updated",
					taskId: task.id,
					prompt: prompt
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

}