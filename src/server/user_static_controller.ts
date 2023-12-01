import {promises as Fs} from "fs"
import * as FsSync from "fs"
import * as Path from "path"
import {watchDirectory} from "server/dir_watcher"
import {ThumbnailController} from "server/thumbnail_controller"
import {isPathInsidePath} from "server/utils/is_path_inside_path"
import ProbeImageSize from "probe-image-size"
import {sortBy} from "common/utils/sort_by"

interface Props {
	readonly directory: string
	readonly thumbnails: {
		readonly directory: string
		readonly height: number
	}
}

export interface UserStaticPictureDescription {
	readonly width: number
	readonly height: number
	readonly name: string
}

export class UserStaticController {
	readonly name = "User static controller"

	private readonly thumbnailController: ThumbnailController
	private watcher: ReturnType<typeof watchDirectory> | null = null
	private pictureDescriptions: readonly UserStaticPictureDescription[] = []

	constructor(readonly props: Props) {
		this.thumbnailController = new ThumbnailController(props.thumbnails)
	}

	async start(): Promise<void> {
		await Promise.all([
			Fs.mkdir(this.props.directory, {recursive: true}),
			this.thumbnailController.start()
		])

		this.watcher = watchDirectory(this.props.directory, /.(?:png|jpe?g|webp)$/i, () => void this.rebuildEverything())
		await this.rebuildEverything()
	}

	stop(): void {
		if(this.watcher){
			this.watcher.close()
			this.watcher = null
		}
	}

	private async rebuildEverything(): Promise<void> {
		await Promise.all([
			this.thumbnailController.updateThumbnailsByDirectory(this.props.directory),
			this.rebuildDescriptions()
		])
	}

	private async rebuildDescriptions(): Promise<void> {
		const files = await Fs.readdir(this.props.directory)
		const unsortedResult = await Promise.all(files.map(async filename => {
			const path = this.getPicturePath(filename)
			const stream = FsSync.createReadStream(path)
			const {width, height} = await ProbeImageSize(stream)
			return {name: filename, width, height}
		}))
		// they are also sorted in thumbnail controller
		// they must match in order, otherwise client won't be able to match thumbnails with pictures properly
		const result = sortBy(unsortedResult, desc => desc.name)
		this.pictureDescriptions = result
	}

	async getThumbnails(): Promise<Buffer> {
		return await this.thumbnailController.getAllThumbnailsPack()
	}

	async getPictureDescriptions(): Promise<readonly UserStaticPictureDescription[]> {
		return this.pictureDescriptions
	}

	private getPicturePath(name: string): string {
		const path = Path.resolve(this.props.directory, name)
		if(!isPathInsidePath(path, this.props.directory)){
			throw new Error("Relative paths are not allowed")
		}
		return path
	}

	async getFullPicture(fileName: string): Promise<Buffer> {
		return await Fs.readFile(this.getPicturePath(fileName))
	}
}