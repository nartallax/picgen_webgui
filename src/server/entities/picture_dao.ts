import {DAO} from "server/dao"
import * as Path from "path"
import ProbeImageSize from "probe-image-size"
import {promises as Fs} from "fs"
import * as FsSync from "fs"
import {directoryExists, fileExists} from "server/utils/file_exists"
import {unixtime} from "server/utils/unixtime"
import {httpGet} from "server/http/http_req"
import {makeTempFile, makeTempFileName} from "server/utils/with_temp_file"
import {decodePictureMask} from "common/picture_mask_encoding"
import {rasterizePictureMask} from "server/utils/picture_mask_rasterizer"
import {Picture, PictureType, pictureTypeSet} from "common/entities/picture"
import {GenerationTask} from "common/entities/generation_task"
import {generateRandomIdentifier} from "common/utils/generate_random_identifier"
import {ApiError} from "common/infra_entities/api_error"
import {getParamDefList} from "common/entities/parameter"
import {isEnoent} from "server/utils/is_enoent"
import {log} from "server/log"
import {config, context, generationTaskDao, pictureDao, thumbnails, userDao} from "server/server_globals"
import {runWithMinimalContext} from "server/context"

export interface ServerPicture extends Picture {
	directLink: string | null
	fileName: string | null
}

export interface PictureInfo {
	width: number
	height: number
	ext: PictureType
}

let pictureDirCreated = false
async function createPictureDir(imgDir: string) {
	if(pictureDirCreated){
		return
	}
	await Fs.mkdir(imgDir, {recursive: true})
	pictureDirCreated = true
}

export class PictureDAO extends DAO<ServerPicture> {
	readonly name = "Picture DAO"

	protected getTableName(): string {
		return "pictures"
	}

	async start(): Promise<void> {
		const dirPath = config.runningGenerationPictureStorageDir
		if(await directoryExists(dirPath)){
			await Fs.rm(dirPath, {recursive: true})
		}

		await Fs.mkdir(dirPath, {recursive: true})

		// this is not very performant, but whatever, we don't have a lot of users anyway
		await runWithMinimalContext(async() => {
			const users = await userDao.queryAll()
			for(const user of users){
				await this.tryCleanupExcessivePicturesOfUser(user.id)
			}
		})
	}

	protected override fieldFromDb<K extends keyof ServerPicture & string>(field: K, value: ServerPicture[K]): unknown {
		switch(field){
			case "isUsedAsArgument":
			case "deleted":
				return !!value
			case "modifiedArguments": return value === null ? null : JSON.parse(value as string)
			default: return value
		}
	}

	protected fieldToDb<K extends keyof ServerPicture & string>(field: K, value: ServerPicture[K]): unknown {
		switch(field){
			case "modifiedArguments": return value === null ? null : JSON.stringify(value)
			default: return value
		}
	}

	stripServerData(pic: ServerPicture): Picture {
		return {
			id: pic.id,
			creationTime: pic.creationTime,
			generationTaskId: pic.generationTaskId,
			ownerUserId: pic.ownerUserId,
			ext: pic.ext,
			name: pic.name,
			salt: pic.salt,
			modifiedArguments: pic.modifiedArguments,
			favoritesAddTime: pic.favoritesAddTime,
			deleted: pic.deleted,
			isUsedAsArgument: pic.isUsedAsArgument
		}
	}

	async uploadPictureAsArgumentAndValidate(paramSetName: string, paramName: string, fileName: string, data: Buffer): Promise<{picture: ServerPicture, info: PictureInfo}> {
		const paramSet = config.parameterSets.find(set => set.internalName === paramSetName)
		if(!paramSet){
			throw new ApiError("validation_not_passed", "Unknown parameter set name: " + paramSetName)
		}

		const paramDef = getParamDefList(paramSet).find(def => def.jsonName === paramName)
		if(!paramDef){
			throw new ApiError("validation_not_passed", "Unknown parameter name: " + paramName)
		}
		if(paramDef.type !== "picture"){
			throw new ApiError("validation_not_passed", `Parameter ${paramName} is not picture parameter, it's ${paramDef.type} parameter. You cannot upload a picture as this parameter value.`)
		}

		const pictureInfo = await generationTaskDao.validateInputPicture(data, paramDef)
		const user = await userDao.getCurrent()
		const serverPic = await pictureDao.storeExternalPicture(data, user.id, fileName, pictureInfo.ext)
		return {picture: serverPic, info: pictureInfo}
	}

	protected makeFullPicturePath(fileName: string): string {
		return Path.resolve(config.pictureStorageDir, fileName)
	}

	private getSalt(): number {
		return Math.floor(Math.random() * 0xffffffff)
	}

	async storeGeneratedPictureByContent(data: Buffer, genTask: GenerationTask, index: number, ext: PictureType, modifiedArguments: ServerPicture["modifiedArguments"], otherFields?: Partial<ServerPicture>): Promise<ServerPicture> {
		return await this.storePicture(data, {
			generationTaskId: genTask.id,
			ownerUserId: genTask.userId,
			ext: ext,
			name: (index + 1) + "",
			salt: this.getSalt(),
			modifiedArguments,
			favoritesAddTime: null,
			deleted: false,
			isUsedAsArgument: false,
			...(otherFields || {})
		})
	}

	async storeGeneratedPictureByPathReference(path: string, genTask: GenerationTask, index: number, ext: PictureType, modifiedArguments: ServerPicture["modifiedArguments"], otherFields?: Partial<ServerPicture>): Promise<ServerPicture> {
		const relPath = Path.relative(config.pictureStorageDir, path)
		const result = await this.create({
			creationTime: unixtime(),
			directLink: null,
			fileName: relPath,
			generationTaskId: genTask.id,
			ownerUserId: genTask.userId,
			ext: ext,
			name: (index + 1) + "",
			salt: this.getSalt(),
			modifiedArguments,
			favoritesAddTime: null,
			deleted: false,
			isUsedAsArgument: false,
			...(otherFields || {})
		})
		await thumbnails.makeThumbnail(result)
		return result
	}

	async storeExternalPicture(data: Buffer, userId: number, name: string, ext: PictureType, otherFields?: Partial<ServerPicture>): Promise<ServerPicture> {
		return await this.storePicture(data, {
			generationTaskId: null,
			ownerUserId: userId,
			ext: ext,
			name: name,
			salt: this.getSalt(),
			modifiedArguments: null,
			favoritesAddTime: null,
			deleted: false,
			isUsedAsArgument: false,
			...(otherFields || {})
		})
	}

	private async storePicture(data: Buffer, picture: Omit<Picture, "id" | "creationTime">): Promise<ServerPicture> {
		await createPictureDir(config.pictureStorageDir)
		const fileName = await generateRandomIdentifier(fileName => fileExists(this.makeFullPicturePath(fileName)))
		const filePath = this.makeFullPicturePath(fileName)
		try {
			await Fs.writeFile(filePath, data)
			const result = await this.create({
				creationTime: unixtime(),
				directLink: null,
				fileName: fileName,
				...picture
			})
			await thumbnails.makeThumbnail(result)
			return result
		} catch(e){
			try {
				await Fs.rm(filePath)
			} catch(e){
				// whatever
			}
			throw e
		}
	}

	async getPictureInfo(picture: ServerPicture | Buffer): Promise<PictureInfo> {
		if(picture instanceof Buffer){
			const rawInfo = ProbeImageSize.sync(picture)
			if(!rawInfo){
				throw new Error("Failed to get picture info from data. Maybe that's not a picture at all?")
			}
			return this.fixPictureInfo(rawInfo)
		} else if(picture.directLink){
			return this.fixPictureInfo(await ProbeImageSize(picture.directLink))
		} else if(picture.fileName){
			return this.fixPictureInfo(await ProbeImageSize(FsSync.createReadStream(this.makeFullPicturePath(picture.fileName))))
		} else {
			throw new Error("Cannot get picture info: no direct link, no file name, no data.")
		}
	}

	private fixPictureInfo(info: {width: number, height: number, type: string}): PictureInfo {
		let ext = info.type.toLowerCase()
		if(ext === "jpeg"){
			ext = "jpg"
		}
		assertIsPictureType(ext)
		return {
			width: info.width,
			height: info.height,
			ext
		}
	}

	async getPictureData(picture: ServerPicture): Promise<Buffer> {
		if(picture.directLink){
			return await httpGet(picture.directLink)
		} else if(picture.fileName){
			return await Fs.readFile(this.makeFullPicturePath(picture.fileName))
		} else {
			throw new Error(`Picture #${picture.id} does not have link nor file path! Cannot read it.`)
		}
	}

	async getPicturePathForGenerationRun(picture: ServerPicture, info?: PictureInfo): Promise<{path: string, info: PictureInfo}> {
		info ??= await this.getPictureInfo(picture)
		const pictureBytes = await this.getPictureData(picture)
		const runningGenDir = config.runningGenerationPictureStorageDir
		return {
			path: await makeTempFile(pictureBytes, info.ext, runningGenDir),
			info: info
		}
	}

	async getMaskPathForGenerationRun(mask: string, info: PictureInfo): Promise<string> {
		const runningGenDir = config.runningGenerationPictureStorageDir
		const maskData = decodePictureMask(mask)
		const path = await makeTempFileName("png", runningGenDir)
		await rasterizePictureMask(maskData, path, info)
		return path
	}

	// yeah, it's just rm
	// but I want to keep all FS stuff within this DAO
	async cleanupPictureOrMaskAfterGenerationRun(path: string): Promise<void> {
		await Fs.rm(path)
	}

	override async delete(picture: ServerPicture): Promise<void> {
		const [,,delRes] = await Promise.all([
			this.rmPictureFile(picture),
			thumbnails.deleteThumbnail(picture),
			super.delete(picture)
		])
		return delRes
	}

	private async rmPictureFile(picture: ServerPicture): Promise<void> {
		if(picture.fileName){ // picture can have no filename if it is stored externally somewhere
			const fullName = this.makeFullPicturePath(picture.fileName)
			try {
				await Fs.rm(fullName)
			} catch(e){
				if(isEnoent(e)){
					log("No picture file; skipping deletion: " + fullName)
				} else {
					throw e
				}
			}
		}
	}

	async tryCleanupExcessivePicturesOfUser(userId: number): Promise<void> {
		const taskIdField: keyof Picture = "generationTaskId"
		const idField: keyof Picture = "id"
		const favTimeField: keyof Picture = "favoritesAddTime"
		const ownerField: keyof Picture = "ownerUserId"
		const delField: keyof Picture = "deleted"
		const isUsedAsArgField: keyof Picture = "isUsedAsArgument"
		const tasksWithPicCount = await context.get().db.query<Pick<Picture, "generationTaskId"> & {taskPicCount: number}>(`
			select "${taskIdField}", count("${idField}") as "taskPicCount"
				from "pictures"
				where "${taskIdField}" is not null
					and not "${isUsedAsArgField}"
					and "${favTimeField}" is null
					and not "${delField}"
					and "${ownerField}" = ?
				group by "${taskIdField}"
				order by "${taskIdField}" desc
		`, [userId])
		// we technically could delete even not task-related pictures
		// because isUsedAsArgument is quite reliable
		// but this will introduce other problems, like ordering
		// I'll do it later maybe, I don't want to rewrite this function right now
		let sumCount = tasksWithPicCount.map(task => task.taskPicCount).reduce((a, b) => a + b, 0)
		while(sumCount > config.pictureCleanup.resultPictureLimitPerUser){
			const lastTask = tasksWithPicCount.pop()
			if(!lastTask){
				log(`Trying to cleanup pictures of user #${userId}, but user don't have enough tasks to met cleanup quota. Check the config value (it's ${config.pictureCleanup} now)`)
				return
			}
			const pics = (await this.queryAllByFieldValue("generationTaskId", lastTask.generationTaskId))
				.filter(x => !x.deleted && !x.favoritesAddTime && !x.isUsedAsArgument)
			sumCount -= pics.length
			await Promise.all([
				...pics.map(pic => this.update({...pic, deleted: true})),
				...pics.map(pic => this.rmPictureFile(pic))
			])
			log(`Cleaned up ${pics.length} pictures from task #${lastTask.generationTaskId} of user #${userId}`)
		}
		log(`User #${userId} has ${sumCount} resulting pictures, which fits in the limit of ${config.pictureCleanup.resultPictureLimitPerUser}`)
	}

}

export function assertIsPictureType(x: string): asserts x is PictureType {
	if(!pictureTypeSet.has(x as PictureType)){
		throw new Error(`"${x}" is not a known picture type.`)
	}
}