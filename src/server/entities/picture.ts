import {GenerationTask, Picture} from "common/entity_types"
import {DAO} from "server/dao"
import * as Crypto from "crypto"
import * as Path from "path"
import {promises as Fs} from "fs"
import {fileExists} from "server/utils/file_exists"
import {unixtime} from "server/utils/unixtime"
import {RequestContext, UserlessContext} from "server/request_context"
import {httpGet} from "server/http/http_req"

export interface ServerPicture extends Picture {
	directLink: string | null
	fileName: string | null
}

let pictureDirCreated = false
async function createPictureDir(imgDir: string) {
	if(pictureDirCreated){
		return
	}
	await Fs.mkdir(imgDir, {recursive: true})
	pictureDirCreated = true
}

export class UserlessPictureDAO<C extends UserlessContext = UserlessContext> extends DAO<ServerPicture, C> {

	protected getTableName(): string {
		return "pictures"
	}

	stripServerData(pic: ServerPicture): Picture {
		return {
			id: pic.id,
			creationTime: pic.creationTime,
			generationTaskId: pic.generationTaskId,
			ownerUserId: pic.ownerUserId,
			ext: pic.ext
		}
	}

	protected makeFullPicturePath(fileName: string): string {
		return Path.resolve(this.getContext().config.pictureStorageDir, fileName)
	}

	async storeGeneratedPicture(data: Buffer, genTask: GenerationTask, ext: string): Promise<ServerPicture> {
		await createPictureDir(this.getContext().config.pictureStorageDir)
		const {fileName, filePath} = await this.findFileName(ext)
		try {
			await Fs.writeFile(filePath, data)
			return await this.create({
				creationTime: unixtime(),
				directLink: null,
				fileName: fileName,
				generationTaskId: genTask.id,
				ownerUserId: genTask.userId,
				ext: ext
			})
		} catch(e){
			try {
				await Fs.rm(filePath)
			} catch(e){
				// whatever
			}
			throw e
		}
	}

	private async findFileName(ext: string): Promise<{fileName: string, filePath: string}> {
		while(true){
			const fileName = Crypto.randomBytes(16).toString("hex") + "." + ext
			const filePath = this.makeFullPicturePath(fileName)
			if(!(await fileExists(filePath))){
				return {fileName, filePath}
			}
		}
	}

}

export class CompletePictureDAO extends UserlessPictureDAO<RequestContext> {

	async getPictureData(picture: ServerPicture): Promise<Buffer> {
		if(picture.directLink){
			return await httpGet(picture.directLink)
		} else if(picture.fileName){
			return await Fs.readFile(this.makeFullPicturePath(picture.fileName))
		} else {
			throw new Error(`Picture #${picture.id} does not have link nor file path! Cannot read it.`)
		}
	}

}