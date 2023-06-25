import Sharp from "sharp"
import * as Path from "path"
import {promises as Fs} from "fs"
import {directoryExists} from "server/utils/file_exists"
import {ServerPicture} from "server/entities/picture_dao"
import {pictureDao} from "server/server_globals"

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
		const srcBytes = await pictureDao.getPictureData(picture)
		const webpBytes = await Sharp(srcBytes)
			.resize({height: this.props.height})
			.webp({effort: 6})
			.toBuffer()
		await Fs.writeFile(this.thumbnailPathOf(picture), webpBytes)
	}

	async getThumbnail(picture: ServerPicture): Promise<Buffer> {
		return await Fs.readFile(this.thumbnailPathOf(picture))
	}
}