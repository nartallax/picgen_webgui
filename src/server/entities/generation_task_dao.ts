import {ApiError} from "common/infra_entities/api_error"
import {DAO} from "server/dao"
import {PictureInfo, ServerPicture} from "server/entities/picture_dao"
import {GenerationTask, GenerationTaskInputData, GenerationTaskStatus, GenerationTaskWithPictures} from "common/entities/generation_task"
import {GenParameter, GenerationParameterSet, PictureGenParam, getParamDefList} from "common/entities/parameter"
import {isPictureArgument} from "common/entities/arguments"
import {config, pictureDao, taskQueue, websocketServer} from "server/server_globals"
import {FtsTable} from "server/fts_table"
import {log} from "server/log"
import {sortByIdArray} from "server/utils/sort_by_id_array"
import {LockSet} from "server/utils/lock_set"
import {sortBy} from "common/utils/sort_by"

interface DbGenerationTask extends Omit<GenerationTask, "arguments" | "status"> {
	arguments: string
	status: GenerationTaskStatus
}

interface ServerPictureArgument {
	picture: string
	mask?: string
}

type ServerGenerationTaskArgument = number | boolean | string | ServerPictureArgument

export interface ServerGenerationTaskInputData extends Omit<GenerationTaskInputData, "arguments"> {
	arguments: {[key: string]: ServerGenerationTaskArgument}
}

export function getServerGenParamDefault(def: GenParameter): ServerGenerationTaskArgument | undefined {
	return "default" in def ? def.default : undefined
}

export class GenerationTaskDAO extends DAO<GenerationTask, DbGenerationTask> {

	readonly locks = new LockSet<number>()

	readonly ftsTable = new FtsTable("generationTasksFts")

	protected getTableName(): string {
		return "generationTasks"
	}

	protected override fieldFromDb<K extends keyof DbGenerationTask & keyof GenerationTask & string>(field: K, value: DbGenerationTask[K]): unknown {
		switch(field){
			case "status": return GenerationTaskStatus[value as DbGenerationTask["status"]]
			case "arguments": return JSON.parse(value as DbGenerationTask["arguments"])
			default: return value
		}
	}

	protected fieldToDb<K extends keyof DbGenerationTask & keyof GenerationTask & string>(field: K, value: GenerationTask[K]): unknown {
		switch(field){
			case "status": return GenerationTaskStatus[value as GenerationTask["status"]]
			case "arguments": return JSON.stringify(value as GenerationTask["arguments"])
			default: return value
		}
	}

	// get next queued task, possibly moving this task up the queue if there are locked tasks before it
	async reorderAndGetNextInQueue(): Promise<GenerationTask | null> {
		let tasks = await this.queryAllByFieldValueIn("status", ["queued", "lockedForEdit"])
		tasks = sortBy(tasks, task => task.runOrder)

		const nonLockedTasks = tasks.filter(task => task.status !== "lockedForEdit")
		const firstNonLockedTask = nonLockedTasks[0]
		if(!firstNonLockedTask){
			return null
		}

		if(firstNonLockedTask !== tasks[0]){
			tasks = [
				firstNonLockedTask,
				...tasks.filter(task => task !== firstNonLockedTask)
			]
			await this.reorderTasksByOrder(tasks)
		}

		return firstNonLockedTask
	}

	// change runOrder of tasks so they go in order they appear in the array
	async reorderTasksByOrder(tasks: readonly GenerationTask[]): Promise<{id: number, runOrder: number}[]> {
		// higher value goes first, so lowest pops first
		const availableRunOrders = tasks.map(task => task.runOrder).sort((a, b) => b - a)
		const pairs: [number, number][] = []
		for(const {id} of tasks){
			pairs.push([id, availableRunOrders.pop()!])
		}
		await this.updateMultipleFieldByCase("runOrder", pairs)

		const objPairs = pairs.map(([id, runOrder]) => ({id, runOrder}))

		// maybe some users shouldn't know about other users tasks here...?
		// but they still kinda know because run order is sequental
		// so, whatever
		websocketServer.sendToAll({type: "task_reordering", orderPairs: objPairs})

		return objPairs
	}

	async getAllInQueue(): Promise<GenerationTask[]> {
		return this.querySortedFiltered("status", "queued", "runOrder", false)
	}

	async killAllQueued(userId: number | null): Promise<void> {
		const queuedTasks = await this.getAllInQueue()
		for(const task of queuedTasks){
			await taskQueue.kill(task.id, userId)
		}
	}

	async killAllQueuedAndRunning(userId: number | null): Promise<void> {
		await this.killAllQueued(userId)
		const runningTask = await this.queryRunning()
		if(runningTask){
			await taskQueue.kill(runningTask.id, userId)
		}
	}

	queryRunning(): Promise<GenerationTask | null> {
		return this.queryByFieldValueIn("status", ["running", "warmingUp"])
	}

	queryEditLocked(): Promise<GenerationTask[]> {
		return this.queryAllByFieldValue("status", "lockedForEdit")
	}

	queryEditLockedByUser(userId: number): Promise<GenerationTask[]> {
		return this.queryAllByTwoFieldValues("status", "lockedForEdit", "userId", userId)
	}

	override async create(task: Omit<GenerationTask, "id">): Promise<GenerationTask> {
		const result = await super.create(task)
		await this.updateFullTextSearch(result, true)
		return result
	}

	override async update(task: GenerationTask): Promise<void> {
		const result = await super.update(task)
		await this.updateFullTextSearch(task)
		return result
	}

	// you can't just pass to generator raw params you got from user
	// even if they are all valid, sometimes they contain IDs that refers to entities in our DB
	// which must be resolved in one way or another before passed to generator
	async prepareInputData(origInputData: GenerationTaskInputData): Promise<ServerGenerationTaskInputData> {
		const resultInputData: ServerGenerationTaskInputData = JSON.parse(JSON.stringify(origInputData))
		const paramDefs = this.getParams(origInputData.paramSetName)

		for(const def of paramDefs){
			const arg = origInputData.arguments[def.jsonName]
			if(arg === undefined){
				if(def.type !== "picture"){
					const dflt = getServerGenParamDefault(def)
					if(dflt === undefined){
						// should never happen; probably will be caught at validation
						throw new ApiError("validation_not_passed", `Generation argument ${def.jsonName} is absent`)
					}
					resultInputData.arguments[def.jsonName] = dflt
				}
				continue
			}

			if(def.type === "picture"){
				if(!isPictureArgument(arg)){
					throw new ApiError("validation_not_passed", `Generation argument ${def.jsonName} should be a description of picture; it is ${JSON.stringify(arg)} now.`)
				}
				const pic = await pictureDao.getById(arg.id)
				const {path: picturePath, info: pictureInfo} = await pictureDao.getPicturePathForGenerationRun(pic)
				const newParamValue: ServerPictureArgument = {
					picture: picturePath
				}
				resultInputData.arguments[def.jsonName] = newParamValue
				if(arg.mask){
					newParamValue.mask = await pictureDao.getMaskPathForGenerationRun(arg.mask, pictureInfo)
				}
			}
		}

		return resultInputData
	}

	async cleanupInputData(inputData: ServerGenerationTaskInputData): Promise<void> {
		const paramDefs = this.getParams(inputData.paramSetName)
		for(const def of paramDefs){
			if(def.type !== "picture"){
				continue
			}
			const paramValue = inputData.arguments[def.jsonName]
			if(paramValue === undefined){
				continue
			}
			if(typeof(paramValue) !== "object" || paramValue === null || typeof(paramValue.picture) !== "string"){
				throw new Error(`Cannot cleanup after task finish: expected picture path as ${def.jsonName}, got ${paramValue} (${JSON.stringify(paramValue)})`)
			}
			await pictureDao.cleanupPictureOrMaskAfterGenerationRun(paramValue.picture)
			if(paramValue.mask){
				await pictureDao.cleanupPictureOrMaskAfterGenerationRun(paramValue.mask)
			}
		}
	}

	private getParamSet(name: string): GenerationParameterSet {
		const paramSet = config.parameterSets.find(set => set.internalName === name)
		if(!paramSet){
			throw new ApiError("validation_not_passed", `Name ${name} is not a known parameter set name.`)
		}

		return paramSet
	}

	private getParams(name: string): GenParameter[] {
		return getParamDefList(this.getParamSet(name))
	}

	// returns list of pictures used in this generation task as inputs.
	// those pictures should then be marked as inputs, to avoid deletion
	async validateInputData(inputData: GenerationTaskInputData): Promise<ServerPicture[]> {
		const result: ServerPicture[] = []
		const paramDefs = this.getParams(inputData.paramSetName)
		for(const def of paramDefs){
			const argument = inputData.arguments[def.jsonName]
			if(argument === undefined){
				if(getServerGenParamDefault(def) !== undefined){
					continue // parameter not passed, whatever, we can live with it
				}
				throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} is absent`)
			}

			switch(def.type){
				case "bool":
					if(argument !== true && argument !== false){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be boolean; it is ${argument} now.`)
					}
					break
				case "float":
				case "int":
					if(typeof(argument) !== "number"){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be number; it is ${argument} now.`)
					}
					if(def.max !== undefined && argument > def.max){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should not be higher than ${def.max}; it is ${argument} now.`)
					}
					if(def.min !== undefined && argument < def.min){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should not be lower than ${def.min}; it is ${argument} now.`)
					}
					if(def.type === "int"){
						if(argument % 1){
							throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be integer (i.e. should not have fractional part); it is ${argument} now.`)
						}
						if(def.step !== undefined && argument % def.step){
							throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be divisible evenly by ${def.step}; it is ${argument} now.`)
						}
					}
					break
				case "string":
					if(typeof(argument) !== "string"){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be string; it is ${argument} now.`)
					}
					if(def.minLength !== undefined && argument.length < def.minLength){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at least ${def.minLength} characters long; it is "${argument}" now.`)
					}
					if(def.maxLength !== undefined && argument.length > def.maxLength){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at most ${def.minLength} characters long; it is "${argument}" now.`)
					}
					break
				case "picture":{
					if(!isPictureArgument(argument)){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be a description of picture; it is ${argument} now.`)
					}
					const picture = await pictureDao.getById(argument.id)
					if(picture.salt !== argument.salt){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} has incorrect salt.`)
					}
					await this.validateInputPicture(picture, def)
					result.push(picture)
				} break
			}
		}
		return result
	}

	async validateInputPicture(picture: PictureInfo, def: PictureGenParam): Promise<void> {
		if(def.minHeight !== undefined && picture.height < def.minHeight){
			throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at least ${def.minHeight}px in height; it is ${picture.height}px now.`)
		}

		if(def.maxHeight !== undefined && picture.height > def.maxHeight){
			throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at most ${def.maxHeight}px in height; it is ${picture.height}px now.`)
		}

		if(def.minWidth !== undefined && picture.width < def.minWidth){
			throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at least ${def.minWidth}px wide; it is ${picture.width}px now.`)
		}

		if(def.maxWidth !== undefined && picture.width > def.maxWidth){
			throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at most ${def.maxWidth}px wide; it is ${picture.width}px now.`)
		}

		if(def.allowedTypes){
			if(!(def.allowedTypes as readonly string[]).includes(picture.ext)){
				throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should contain picture of one of the following formats: ${def.allowedTypes.join(", ")}; it is ${picture.ext} now.`)
			}
		}

		if(def.sizeStep !== undefined){
			if((picture.height % def.sizeStep) !== 0){
				throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should have height evenly divisible by ${def.sizeStep}px; it is ${picture.height}px now.`)
			}
			if((picture.width % def.sizeStep) !== 0){
				throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should have width evenly divisible by ${def.sizeStep}px; it is ${picture.width}px now.`)
			}
		}

		if(def.square && picture.height !== picture.width){
			throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be square (i.e. have height equal width); it is ${picture.width}px x ${picture.height}px now.`)
		}
	}

	override async delete(task: GenerationTask): Promise<void> {
		const pictures = await pictureDao.list({
			filters: [{a: {field: "generationTaskId"}, op: "=", b: {value: task.id}}]
		})

		for(const picture of pictures){
			await pictureDao.delete(picture)
		}

		await this.ftsTable.delete(task.id)

		return await super.delete(task)
	}

	async updateFullTextSearch(task: GenerationTask, justCreated = false): Promise<void> {
		let primaryParamName = "prompt"

		const paramSet = config.parameterSets.find(paramSet => paramSet.internalName === task.paramSetName)
		if(paramSet){
			primaryParamName = paramSet.primaryParameter.jsonName
		}

		const prompt = task.arguments[primaryParamName]
		if(typeof(prompt) !== "string"){
			log(`Warning: cannot update full-text index for task #${task.id} because argument for primary parameter ${primaryParamName} is not string (is ${typeof(prompt)})`)
			return
		}

		const values = [prompt, task.note]

		if(justCreated){
			await this.ftsTable.add(task.id, task.userId, values)
		} else {
			await this.ftsTable.update(task.id, values)
		}
	}

	async search(text: string, pageSize: number, userId: number | null, lastKnownId: number | null): Promise<GenerationTask[]> {
		const ids = await this.ftsTable.search(text, pageSize, userId, lastKnownId)
		const tasks = await this.queryAllFieldIncludes("id", ids)
		// I do it this way to preserve sorting order of ids
		// just to keep the logic about sorting order in one place (in fts table)
		// sure, it'll be faster to just sort the tasks array, but it won't be a big performance hit either
		return sortByIdArray(ids, tasks)
	}

	async enrichWithPictures(tasks: GenerationTask[]): Promise<GenerationTaskWithPictures[]> {
		const ids = tasks.map(x => x.id)
		const serverPictures = await pictureDao.queryAllFieldIncludes("generationTaskId", ids)
		const pictures = serverPictures.map(pic => pictureDao.stripServerData(pic))
		const taskMap = new Map<number, GenerationTaskWithPictures>(tasks.map(task => [task.id, {...task, pictures: []}]))
		for(const picture of pictures){
			const task = taskMap.get(picture.generationTaskId!)!
			task.pictures.push(picture)
		}
		const result = [...taskMap.values()]
		return sortByIdArray(ids, result)
	}

}