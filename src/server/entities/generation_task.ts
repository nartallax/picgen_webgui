import {ApiError} from "common/api_error"
import {DbGenerationTask, GenerationTask, GenerationTaskInputData, GenerationTaskStatus, generationTaskStatusList} from "common/entity_types"
import {DAO} from "server/dao"
import {UserlessContext} from "server/request_context"

const reverseStatusMapping = new Map<number, GenerationTaskStatus>()
Object.entries(generationTaskStatusList).forEach(([name, value]) => reverseStatusMapping.set(value, name as GenerationTaskStatus))

export class GenerationTaskDAO extends DAO<GenerationTask, UserlessContext, DbGenerationTask> {

	protected getTableName(): string {
		return "generationTasks"
	}

	protected override fieldFromDb<K extends keyof DbGenerationTask & keyof GenerationTask & string>(field: K, value: DbGenerationTask[K]): unknown {
		switch(field){
			case "status": return reverseStatusMapping.get(value as DbGenerationTask["status"])
			case "params": return JSON.parse(value as DbGenerationTask["params"])
			default: return value
		}
	}

	protected fieldToDb<K extends keyof DbGenerationTask & keyof GenerationTask & string>(field: K, value: GenerationTask[K]): unknown {
		switch(field){
			case "status": return generationTaskStatusList[value as GenerationTask["status"]]
			case "params": return JSON.stringify(value as GenerationTask["params"])
			default: return value
		}
	}

	async getNextInQueue(): Promise<GenerationTask | undefined> {
		const result = await this.querySortedFiltered("status", "queued", "runOrder", false, 1)
		return result[0]
	}

	getRunning(): Promise<GenerationTask | undefined> {
		return this.mbGetByFieldValue("status", "running")
	}

	validateInputData(inputData: GenerationTaskInputData): void {
		const params = inputData.params
		const paramDefs = this.getContext().config.generationParameters
		for(const def of paramDefs){
			const paramValue = params[def.jsonName]
			if(paramValue === undefined){
				throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} is absent`)
			}

			switch(def.type){
				case "bool":
					if(paramValue !== true && paramValue !== false){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be boolean; it is ${paramValue} now.`)
					}
					break
				case "float":
				case "int":
					if(typeof(paramValue) !== "number"){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be number; it is ${paramValue} now.`)
					}
					if(def.max !== undefined && paramValue > def.max){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should not be higher than ${def.max}; it is ${paramValue} now.`)
					}
					if(def.min !== undefined && paramValue < def.min){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should not be lower than ${def.min}; it is ${paramValue} now.`)
					}
					if(def.type === "int"){
						if(paramValue % 1){
							throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be integer (i.e. should not have fractional part); it is ${paramValue} now.`)
						}
						if(def.step !== undefined && paramValue % def.step){
							throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be divisible evenly by ${def.step}; it is ${paramValue} now.`)
						}
					}
					break
				case "string":
					if(typeof(paramValue) !== "string"){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be string; it is ${paramValue} now.`)
					}
					if(def.minLength !== undefined && paramValue.length < def.minLength){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at least ${def.minLength} characters long; it is "${paramValue}" now.`)
					}
					if(def.maxLength !== undefined && paramValue.length > def.maxLength){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be at most ${def.minLength} characters long; it is "${paramValue}" now.`)
					}
					break
			}
		}
	}

}