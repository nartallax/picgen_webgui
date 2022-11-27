import {ApiError} from "common/api_error"
import {GenerationParameterSet, GenParameterDefinition, getParamDefList, PictureGenParamDefinition} from "common/common_types"
import {DbGenerationTask, GenerationTask, GenerationTaskInputData, GenerationTaskStatus, generationTaskStatusList} from "common/entity_types"
import {DAO} from "server/dao"
import {UserlessContext} from "server/request_context"
import {PictureInfo, ServerPicture} from "server/entities/picture"

const reverseStatusMapping = new Map<number, GenerationTaskStatus>()
Object.entries(generationTaskStatusList).forEach(([name, value]) => reverseStatusMapping.set(value, name as GenerationTaskStatus))

interface ServerPictureParameterValue {
	picture: string
	mask?: string
}

type ServerGenerationTaskParameterValue = number | boolean | string | ServerPictureParameterValue

export interface ServerGenerationTaskInputData extends Omit<GenerationTaskInputData, "params"> {
	params: {[key: string]: ServerGenerationTaskParameterValue}
}

export function getServerGenParamDefault(def: GenParameterDefinition): ServerGenerationTaskParameterValue | undefined {
	return "default" in def ? def.default : undefined
}

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

	getRunning(): Promise<GenerationTask | null> {
		return this.mbGetByFieldValue("status", "running")
	}

	// you can't just pass to generator raw params you got from user
	// even if they are all valid, sometimes they contain IDs that refers to entities in our DB
	// which must be resolved in one way or another before passed to generator
	async prepareInputData(origInputData: GenerationTaskInputData): Promise<ServerGenerationTaskInputData> {
		const context = this.getContext()
		const resultInputData: ServerGenerationTaskInputData = JSON.parse(JSON.stringify(origInputData))
		const paramDefs = this.getParams(origInputData.paramSetName)

		for(const def of paramDefs){
			const paramValue = origInputData.params[def.jsonName]
			if(paramValue === undefined){
				if(def.type !== "picture"){
					const dflt = getServerGenParamDefault(def)
					if(dflt === undefined){
						// should never happen; probably will be caught at validation
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} is absent`)
					}
					resultInputData.params[def.jsonName] = dflt
				}
				continue
			}

			if(def.type === "picture"){
				if(typeof(paramValue) !== "object" || paramValue === null || typeof(paramValue.id) !== "number"){
					throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be a description of picture; it is ${paramValue} now.`)
				}
				const pic = await context.picture.getById(paramValue.id)
				const {path: picturePath, info: pictureInfo} = await context.picture.getPicturePathForGenerationRun(pic)
				const newParamValue: ServerPictureParameterValue = {
					picture: picturePath
				}
				resultInputData.params[def.jsonName] = newParamValue
				if(paramValue.mask){
					newParamValue.mask = await context.picture.getMaskPathForGenerationRun(paramValue.mask, pictureInfo)
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
			const paramValue = inputData.params[def.jsonName]
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

	private getParams(name: string): GenParameterDefinition[] {
		return getParamDefList(this.getParamSet(name))
	}

	async validateInputData(inputData: GenerationTaskInputData): Promise<void> {
		const context = this.getContext()
		const paramDefs = this.getParams(inputData.paramSetName)
		for(const def of paramDefs){
			const paramValue = inputData.params[def.jsonName]
			if(paramValue === undefined){
				if(getServerGenParamDefault(def) !== undefined){
					continue // parameter not passed, whatever, we can live with it
				}
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
				case "picture":{
					if(typeof(paramValue) !== "object" || paramValue === null || typeof(paramValue.id) !== "number"){
						throw new ApiError("validation_not_passed", `Generation parameter ${def.jsonName} should be a description of picture; it is ${paramValue} now.`)
					}
					const picture = await context.picture.getById(paramValue.id)
					await this.validateInputPicture(picture, def)
				} break
			}
		}
	}

	async validateInputPicture(picture: ServerPicture | Buffer, def: PictureGenParamDefinition): Promise<PictureInfo> {
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

}