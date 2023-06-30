import Sharp from "sharp"
import * as Path from "path"
import {promises as Fs} from "fs"
import {directoryExists} from "server/utils/file_exists"
import {ServerPicture} from "server/entities/picture_dao"
import {pictureDao} from "server/server_globals"
import {isEnoent} from "server/utils/is_enoent"
import {log} from "server/log"

export class ThumbnailController {
	constructor(readonly props: {readonly directory: string, readonly height: number}) {}

	async start(): Promise<void> {
		if(!(await directoryExists(this.props.directory))){
			await Fs.mkdir(this.props.directory, {recursive: true})
		}
	}

	private thumbnailPathOf(picture: ServerPicture): string {
		return Path.resolve(this.props.directory, picture.id + ".webp")
	}

	async makeThumbnail(picture: ServerPicture): Promise<void> {
		// log("Making thumbnail for picture #" + picture.id)
		const srcBytes = await pictureDao.getPictureData(picture)
		const webpBytes = await Sharp(srcBytes)
			.resize({height: this.props.height})
			.webp({effort: 6})
			.toBuffer()
		await Fs.writeFile(this.thumbnailPathOf(picture), webpBytes)
		// log("Done; result is " + this.thumbnailPathOf(picture))
	}

	async getThumbnail(picture: ServerPicture): Promise<Buffer> {
		return await Fs.readFile(this.thumbnailPathOf(picture))
	}

	async deleteThumbnail(picture: ServerPicture): Promise<void> {
		try {
			await Fs.unlink(this.thumbnailPathOf(picture))
		} catch(e){
			if(isEnoent(e)){
				log("No thumbnail file for #" + picture.id + "; skipping thumbnail deletion.")
			} else {
				throw e
			}
		}
	}
}