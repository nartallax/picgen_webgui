import {GenerationTask} from "common/entity_types"
import {DAO} from "server/dao"

export class GenerationTaskDAO extends DAO<GenerationTask> {

	protected getTableName(): string {
		return "generationTasks"
	}

}