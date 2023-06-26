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
import {config, generationTaskDao, pictureDao, thumbnails, userDao} from "server/server_globals"

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
	}

	protected override fieldFromDb<K extends keyof ServerPicture & string>(field: K, value: ServerPicture[K]): unknown {
		switch(field){
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
			favoritesAddTime: pic.favoritesAddTime
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

		const pictureInfo = await generationTaskDao.validateInputPicture(data, paramDef)
		const user = await userDao.getCurrent()
		const serverPic = await pictureDao.storeExternalPicture(data, user.id, fileName, pictureInfo.ext)
		return serverPic
	}

	protected makeFullPicturePath(fileName: string): string {
		return Path.resolve(config.pictureStorageDir, fileName)
	}

	private getSalt(): number {
		return Math.floor(Math.random() * 0xffffffff)
	}

	async storeGeneratedPictureByContent(data: Buffer, genTask: GenerationTask, index: number, ext: PictureType, modifiedArguments: ServerPicture["modifiedArguments"]): Promise<ServerPicture> {
		return await this.storePicture(data, {
			generationTaskId: genTask.id,
			ownerUserId: genTask.userId,
			ext: ext,
			name: (index + 1) + "",
			salt: this.getSalt(),
			modifiedArguments,
			favoritesAddTime: null
		})
	}

	async storeGeneratedPictureByPathReference(path: string, genTask: GenerationTask, index: number, ext: PictureType, modifiedArguments: ServerPicture["modifiedArguments"]): Promise<ServerPicture> {
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
			favoritesAddTime: null
		})
		await thumbnails.makeThumbnail(result)
		return result
	}

	async storeExternalPicture(data: Buffer, userId: number, name: string, ext: PictureType): Promise<ServerPicture> {
		return await this.storePicture(data, {
			generationTaskId: null,
			ownerUserId: userId,
			ext: ext,
			name: name,
			salt: this.getSalt(),
			modifiedArguments: null,
			favoritesAddTime: null
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
		if(picture.fileName){
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
		return await super.delete(picture)
	}

}

export function assertIsPictureType(x: string): asserts x is PictureType {
	if(!pictureTypeSet.has(x as PictureType)){
		throw new Error(`"${x}" is not a known picture type.`)
	}
}