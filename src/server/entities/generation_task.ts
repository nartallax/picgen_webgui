import {ApiError} from "common/infra_entities/api_error"
import {DAO} from "server/dao"
import {UserlessContext} from "server/request_context"
import {PictureInfo, ServerPicture} from "server/entities/picture"
import {GenerationTask, GenerationTaskInputData, GenerationTaskStatus} from "common/entities/generation_task"
import {GenParameter, GenerationParameterSet, PictureGenParam, getParamDefList} from "common/entities/parameter"
import {isPictureArgument} from "common/entities/arguments"

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

export class GenerationTaskDAO extends DAO<GenerationTask, UserlessContext, DbGenerationTask> {

	protected getTableName(): string {
		return "generationTasks"
	}

	protected override fieldFromDb<K extends keyof DbGenerationTask & keyof GenerationTask & string>(field: K, value: DbGenerationTask[K]): unknown {
		switch(field){
			case "status": return GenerationTaskStatus[value as DbGenerationTask["status"]] // TODO: cringe
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

	async getNextInQueue(): Promise<GenerationTask | undefined> {
		const result = await this.querySortedFiltered("status", "queued", "runOrder", false, 1)
		return result[0]
	}

	async getAllInQueue(): Promise<GenerationTask[]> {
		return this.querySortedFiltered("status", "queued", "runOrder", false)
	}

	async killAllQueued(userId: number | null): Promise<void> {
		const context = this.getContext()
		const queuedTasks = await context.generationTask.getAllInQueue()
		for(const task of queuedTasks){
			await context.taskQueue.kill(task.id, userId)
		}
	}

	async killAllQueuedAndRunning(userId: number | null): Promise<void> {
		await this.killAllQueued(userId)
		const context = this.getContext()
		const runningTask = await context.generationTask.queryRunning()
		if(runningTask){
			await context.taskQueue.kill(runningTask.id, userId)
		}
	}

	queryRunning(): Promise<GenerationTask | null> {
		return this.queryByFieldValue("status", "running")
	}

	// you can't just pass to generator raw params you got from user
	// even if they are all valid, sometimes they contain IDs that refers to entities in our DB
	// which must be resolved in one way or another before passed to generator
	async prepareInputData(origInputData: GenerationTaskInputData): Promise<ServerGenerationTaskInputData> {
		const context = this.getContext()
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
				const pic = await context.picture.getById(arg.id)
				const {path: picturePath, info: pictureInfo} = await context.picture.getPicturePathForGenerationRun(pic)
				const newParamValue: ServerPictureArgument = {
					picture: picturePath
				}
				resultInputData.arguments[def.jsonName] = newParamValue
				if(arg.mask){
					newParamValue.mask = await context.picture.getMaskPathForGenerationRun(arg.mask, pictureInfo)
				}
			}
		}

		return resultInputData
	}

	async cleanupInputData(inputData: ServerGenerationTaskInputData): Promise<void> {
		const context = this.getContext()
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
			await context.picture.cleanupPictureOrMaskAfterGenerationRun(paramValue.picture)
			if(paramValue.mask){
				await context.picture.cleanupPictureOrMaskAfterGenerationRun(paramValue.mask)
			}
		}
	}

	private getParamSet(name: string): GenerationParameterSet {
		const context = this.getContext()

		const paramSet = context.config.parameterSets.find(set => set.internalName === name)
		if(!paramSet){
			throw new ApiError("validation_not_passed", `Name ${name} is not a known parameter set name.`)
		}

		return paramSet
	}

	private getParams(name: string): GenParameter[] {
		return getParamDefList(this.getParamSet(name))
	}

	async validateInputData(inputData: GenerationTaskInputData): Promise<void> {
		const context = this.getContext()
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
					const picture = await context.picture.getById(argument.id)
					await this.validateInputPicture(picture, def)
				} break
			}
		}
	}

	async validateInputPicture(picture: ServerPicture | Buffer, def: PictureGenParam): Promise<PictureInfo> {
		const context = this.getContext()
		const picInf = await context.picture.getPictureInfo(picture)

		if(def.minHeight !== undefined && picInf.height < def.minHeight){
			throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at least ${def.minHeight}px in height; it is ${picInf.height}px now.`)
		}

		if(def.maxHeight !== undefined && picInf.height > def.maxHeight){
			throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at most ${def.maxHeight}px in height; it is ${picInf.height}px now.`)
		}

		if(def.minWidth !== undefined && picInf.width < def.minWidth){
			throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at least ${def.minWidth}px wide; it is ${picInf.width}px now.`)
		}

		if(def.maxWidth !== undefined && picInf.width > def.maxWidth){
			throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at most ${def.maxWidth}px wide; it is ${picInf.width}px now.`)
		}

		if(def.allowedTypes){
			if(!(def.allowedTypes as readonly string[]).includes(picInf.ext)){
				throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should contain picture of one of the following formats: ${def.allowedTypes.join(", ")}; it is ${picInf.ext} now.`)
			}
		}

		if(def.sizeStep !== undefined){
			if((picInf.height % def.sizeStep) !== 0){
				throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should have height evenly divisible by ${def.sizeStep}px; it is ${picInf.height}px now.`)
			}
			if((picInf.width % def.sizeStep) !== 0){
				throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should have width evenly divisible by ${def.sizeStep}px; it is ${picInf.width}px now.`)
			}
		}

		if(def.square && picInf.height !== picInf.width){
			throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be square (i.e. have height equal width); it is ${picInf.width}px x ${picInf.height}px now.`)
		}

		return picInf
	}

	override async delete(task: GenerationTask): Promise<void> {
		const cont = this.getContext()
		const pictures = await cont.picture.list({
			filters: [{a: {field: "generationTaskId"}, op: "=", b: {value: task.id}}]
		})

		for(const picture of pictures){
			await cont.picture.delete(picture)
		}

		return await super.delete(task)
	}

}