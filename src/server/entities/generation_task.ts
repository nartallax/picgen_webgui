import {DbGenerationTask, GenerationTask, GenerationTaskStatus, generationTaskStatusList} from "common/entity_types"
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

}