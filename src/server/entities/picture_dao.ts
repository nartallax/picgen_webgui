import {DAO} from "server/dao"
import * as Path from "path"
import ProbeImageSize from "probe-image-size"
import {promises as Fs} from "fs"
import * as FsSync from "fs"
import {directoryExists, fileExists} from "server/utils/file_exists"
import {unixtime} from "server/utils/unixtime"
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
	fileName: string
}

// picture pre-storage. only fields that can be extracted from picture bytes alone
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
			await this.markAbsentPicturesAsDeleted()

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
			isUsedAsArgument: pic.isUsedAsArgument,
			width: pic.width,
			height: pic.height
		}
	}

	async uploadPictureAsArgumentAndValidate(paramSetName: string, paramName: string, fileName: string, data: Buffer): Promise<ServerPicture> {
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

		// this is not very optimal, because we will calc this data again when storing
		// but whatever
		const info = await this.getPictureInfo(data)
		await generationTaskDao.validateInputPicture(info, paramDef)
		const user = await userDao.getCurrent()
		const serverPic = await pictureDao.storeExternalPicture(data, user.id, fileName)
		return serverPic
	}

	protected makeFullPicturePath(fileName: string): string {
		return Path.resolve(config.pictureStorageDir, fileName)
	}

	private getSalt(): number {
		return Math.floor(Math.random() * 0xffffffff)
	}

	async storeGeneratedPictureByContent(data: Buffer, genTask: GenerationTask, index: number, modifiedArguments: ServerPicture["modifiedArguments"], otherFields?: Partial<ServerPicture>): Promise<ServerPicture> {
		const info = await this.getPictureInfo(data)
		return await this.storePicture(data, {
			generationTaskId: genTask.id,
			ownerUserId: genTask.userId,
			name: (index + 1) + "",
			salt: this.getSalt(),
			modifiedArguments,
			favoritesAddTime: null,
			deleted: false,
			isUsedAsArgument: false,
			...info,
			...(otherFields || {})
		})
	}

	async storeGeneratedPictureByPathReference(path: string, genTask: GenerationTask, index: number, modifiedArguments: ServerPicture["modifiedArguments"], otherFields?: Partial<ServerPicture>): Promise<ServerPicture> {
		const relPath = Path.relative(config.pictureStorageDir, path)
		const info = await this.getPictureInfo(relPath)
		const result = await this.create({
			creationTime: unixtime(),
			fileName: relPath,
			generationTaskId: genTask.id,
			ownerUserId: genTask.userId,
			name: (index + 1) + "",
			salt: this.getSalt(),
			modifiedArguments,
			favoritesAddTime: null,
			deleted: false,
			isUsedAsArgument: false,
			...info,
			...(otherFields || {})
		})
		await thumbnails.makeThumbnail(result)
		return result
	}

	async storeExternalPicture(data: Buffer, userId: number, name: string, otherFields?: Partial<ServerPicture>): Promise<ServerPicture> {
		const info = await this.getPictureInfo(data)
		return await this.storePicture(data, {
			generationTaskId: null,
			ownerUserId: userId,
			name: name,
			salt: this.getSalt(),
			modifiedArguments: null,
			favoritesAddTime: null,
			deleted: false,
			isUsedAsArgument: false,
			...info,
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

	private async getPictureInfo(picture: string | ServerPicture | Buffer): Promise<PictureInfo> {
		if(picture instanceof Buffer){
			const rawInfo = ProbeImageSize.sync(picture)
			if(!rawInfo){
				throw new Error("Failed to get picture info from data. Maybe that's not a picture at all?")
			}
			return this.fixPictureInfo(rawInfo)
		}
		const relPath = typeof picture === "string" ? picture : picture.fileName
		return this.fixPictureInfo(await ProbeImageSize(FsSync.createReadStream(this.makeFullPicturePath(relPath))))
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
		return await Fs.readFile(this.makeFullPicturePath(picture.fileName))
	}

	async getPicturePathForGenerationRun(picture: ServerPicture): Promise<{path: string, info: PictureInfo}> {
		const info = await this.getPictureInfo(picture)
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

	async markAbsentPicturesAsDeleted(): Promise<void> {
		const db = context.get().db
		const pictures = (await db.query(` 
			select "id", "fileName" from "pictures" where not "deleted"
		`)) as {id: number, fileName: string}[]

		const idsOrNulls = await Promise.all(pictures.map(async({id, fileName}) => {
			const path = this.makeFullPicturePath(fileName)
			try {
				await Fs.stat(path)
				return null
			} catch(e){
				if(isEnoent(e)){
					return id
				} else {
					throw e
				}
			}
		}))

		let ids = idsOrNulls.filter((x): x is number => x !== null)
		if(ids.length < 1){
			return
		}

		log(`\nFound out that ${ids.length} pictures are now deleted on disc. Updating the DB.\n`)
		while(ids.length > 0){
			const packSize = 100
			const pack = ids.slice(0, packSize)
			ids = ids.slice(packSize)
			await db.run(`
				update "pictures" set "deleted" = ? where "id" in (${pack.map(() => "?").join(", ")})
			`, [true, ...pack])
		}
	}

}

export function assertIsPictureType(x: string): asserts x is PictureType {
	if(!pictureTypeSet.has(x as PictureType)){
		throw new Error(`"${x}" is not a known picture type.`)
	}
}