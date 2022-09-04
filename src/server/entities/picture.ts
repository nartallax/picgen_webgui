import {Picture} from "common/entity_types"
import {DAO} from "server/dao"

export interface ServerPicture extends Picture {
	directLink: string | null
	fileName: string | null
}

export class PictureDAO extends DAO<ServerPicture> {

	protected getTableName(): string {
		return "pictures"
	}

	stripServerData(pic: ServerPicture): Picture {
		return {
			id: pic.id,
			creationTime: pic.creationTime,
			generationTaskId: pic.generationTaskId
		}
	}

}