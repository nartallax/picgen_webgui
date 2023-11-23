import Sharp from "sharp"
import * as Path from "path"
import {promises as Fs} from "fs"
import {directoryExists} from "server/utils/file_exists"
import {ServerPicture} from "server/entities/picture_dao"
import {pictureDao} from "server/server_globals"
import {isEnoent} from "server/utils/is_enoent"
import {log} from "server/log"

type ThumbnailablePicture = ServerPicture | string

export class ThumbnailController {
	constructor(readonly props: {readonly directory: string, readonly height: number}) {}

	async start(): Promise<void> {
		if(!(await directoryExists(this.props.directory))){
			await Fs.mkdir(this.props.directory, {recursive: true})
		}
	}

	private getPictureId(picture: ThumbnailablePicture): string {
		return typeof picture === "string" ? Path.basename(picture) : picture.id + ""
	}

	private getPictureIdFromThumbPath(path: string): string {
		return Path.basename(path).replace(/\.webp$/i, "")
	}

	private thumbnailPathOf(picture: ThumbnailablePicture): string {
		return Path.resolve(this.props.directory, this.getPictureId(picture) + ".webp")
	}

	async makeThumbnail(picture: ThumbnailablePicture): Promise<void> {
		// log("Making thumbnail for picture #" + picture.id)
		let srcBytes: Buffer
		if(typeof picture === "string"){
			srcBytes = await Fs.readFile(picture)
		} else {
			srcBytes = await pictureDao.getPictureData(picture)
		}
		const webpBytes = await Sharp(srcBytes)
			.resize({height: this.props.height})
			.webp({effort: 6})
			.toBuffer()
		await Fs.writeFile(this.thumbnailPathOf(picture), webpBytes)
		// log("Done; result is " + this.thumbnailPathOf(picture))
	}

	async getThumbnail(picture: ThumbnailablePicture): Promise<Buffer> {
		return await Fs.readFile(this.thumbnailPathOf(picture))
	}

	async deleteThumbnail(picture: ThumbnailablePicture): Promise<void> {
		try {
			await Fs.unlink(this.thumbnailPathOf(picture))
		} catch(e){
			if(isEnoent(e)){
				log("No thumbnail file for picture " + this.getPictureId(picture) + "; skipping thumbnail deletion.")
			} else {
				throw e
			}
		}
	}

	async updateThumbnailsByDirectory(srcDir: string): Promise<void> {
		const [currentSrcFiles, currentThumbnails] = await Promise.all([
			await Fs.readdir(srcDir),
			await Fs.readdir(this.props.directory)
		])

		log("Rebuilding " + currentSrcFiles.length + " thumbnails.")

		// it's easier to just rebuild all of them rather than diff-ing about which files are changed/added/deleted
		await Promise.all(currentThumbnails.map(fileName => {
			const oldThumbnailPath = Path.resolve(this.props.directory, fileName)
			return Fs.unlink(oldThumbnailPath)
		}))

		await Promise.all(currentSrcFiles.map(fileName => {
			const srcPath = Path.resolve(srcDir, fileName)
			return this.makeThumbnail(srcPath)
		}))
	}

	async getThumbnailPack(pictures: readonly ThumbnailablePicture[]): Promise<Buffer> {
		const thumbsBytes = await Promise.all(pictures.map(pic => this.getThumbnail(pic)))
		const result = Buffer.alloc(thumbsBytes.map(bytes => bytes.length + 4).reduce((a, b) => a + b, 0))

		let offset = 0
		for(let i = 0; i < thumbsBytes.length; i++){
			let len = thumbsBytes[i]!.length
			for(let j = 0; j < 4; j++){
				result[offset++] = len & 0xff
				len >>= 8
			}
		}

		for(const bytes of thumbsBytes){
			bytes.copy(result, offset)
			offset += bytes.length
		}

		return result
	}

	async getAllThumbnailsPack(): Promise<Buffer> {
		const picIds = (await Fs.readdir(this.props.directory))
			.map(thumbPath => this.getPictureIdFromThumbPath(thumbPath))
			.sort()
		return this.getThumbnailPack(picIds)
	}

}