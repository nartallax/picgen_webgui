import {runWithMinimalContext} from "server/context"
import {log} from "server/log"
import {generationTaskDao, taskQueue, websocketServer} from "server/server_globals"
import {unixtime} from "server/utils/unixtime"

const timeOutDuration = 5 * 60
const checkIntervalDuration = 1 * 60

export class TaskEditLockController {

	readonly name = "Task edit lock controller"

	private readonly lastLockRenewalTime = new Map<number, number>()
	private interval: ReturnType<typeof setInterval> | null = null

	async acquireLock(taskId: number): Promise<void> {
		const task = await generationTaskDao.getById(taskId)
		if(task.status === "lockedForEdit"){
			return
		}
		if(task.status !== "queued"){
			throw new Error("Task is " + task.status + ", and is not lockable in this status")
		}
		task.status = "lockedForEdit"
		await generationTaskDao.update(task)
		log(`Task #${taskId} is locked for edit.`)
		this.afterLockAcquired(taskId)
	}

	renewLock(taskId: number): void {
		if(!this.lastLockRenewalTime.has(taskId)){
			throw new Error("Cannot renew lock - the task is not locked.")
		}
		log(`Edit lock for task #${taskId} is renewed.`)
		this.lastLockRenewalTime.set(taskId, unixtime())
	}

	async releaseLock(taskId: number): Promise<void> {
		const task = await generationTaskDao.getById(taskId)
		if(task.status === "lockedForEdit"){
			task.status = "queued"
			await generationTaskDao.update(task)
		}
		log(`Edit lock for task #${taskId} is released explicitly.`)
		void taskQueue.tryStartNextGeneration()
		this.afterLockReleased(taskId)
	}

	async releaseAllLocksOfUser(userId: number): Promise<void> {
		// not very efficient, but there won't be a lot of them, so whatever
		const tasks = await generationTaskDao.queryEditLockedByUser(userId)
		for(const task of tasks){
			task.status = "queued"
			await generationTaskDao.update(task)
			log(`Edit lock for task #${task.id} is released by user mass-release.`)
			this.afterLockReleased(task.id)
		}
		void taskQueue.tryStartNextGeneration()
	}

	private async releaseAllLocks(): Promise<void> {
		const tasks = await generationTaskDao.queryEditLocked()
		for(const task of tasks){
			task.status = "queued"
			await generationTaskDao.update(task)
			log(`Edit lock for task #${task.id} is released by mass-release.`)
			this.afterLockReleased(task.id)
		}
	}

	private async unlockAllTimedOut(): Promise<void> {
		const now = unixtime()
		const timedOutTasks = [...this.lastLockRenewalTime]
			.filter(([, renewalTime]) => {
				const timePassed = now - renewalTime
				return timePassed >= timeOutDuration
			})
			.map(([taskId]) => taskId)
		if(timedOutTasks.length < 1){
			return
		}

		const tasks = await generationTaskDao.getByIds(timedOutTasks)
		for(const task of tasks){
			task.status = "queued"
			await generationTaskDao.update(task)
			log(`Edit lock for task #${task.id} is released by timeout.`)
			this.afterLockReleased(task.id)
		}

		void taskQueue.tryStartNextGeneration()
	}

	private afterLockReleased(taskId: number): void {
		this.lastLockRenewalTime.delete(taskId)
		websocketServer.sendToAll({type: "task_edit_unlocked", taskId})
	}

	private afterLockAcquired(taskId: number): void {
		this.lastLockRenewalTime.set(taskId, unixtime())
		websocketServer.sendToAll({type: "task_edit_locked", taskId})
	}

	async start(): Promise<void> {
		await runWithMinimalContext(async() => {
			await this.releaseAllLocks()
		})
		this.interval = setInterval(async() => {
			await runWithMinimalContext(async() => {
				await generationTaskDao.locks.withGlobalLock(async() => {
					await this.unlockAllTimedOut()
				})
			})
		}, checkIntervalDuration)
	}

	stop(): void {
		if(this.interval !== null){
			clearInterval(this.interval)
			this.interval = null
		}
	}

}