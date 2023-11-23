import {promises as Fs} from "fs"
import * as Path from "path"
import {watchDirectory} from "server/dir_watcher"
import {ThumbnailController} from "server/thumbnail_controller"
import {isPathInsidePath} from "server/utils/is_path_inside_path"

interface Props {
	readonly directory: string
	readonly thumbnails: {
		readonly directory: string
		readonly height: number
	}
}

export class UserStaticController {
	readonly name = "User static controller"

	private readonly thumbnailController: ThumbnailController
	private watcher: ReturnType<typeof watchDirectory> | null = null

	constructor(readonly props: Props) {
		this.thumbnailController = new ThumbnailController(props.thumbnails)
	}

	async start(): Promise<void> {
		await Promise.all([
			Fs.mkdir(this.props.directory, {recursive: true}),
			this.thumbnailController.start()
		])

		this.watcher = watchDirectory(this.props.directory, /.(?:png|jpe?g|webp)$/i, () => void this.rebuildThumbnails())
		await this.rebuildThumbnails()
	}

	stop(): void {
		if(this.watcher){
			this.watcher.close()
			this.watcher = null
		}
	}

	private async rebuildThumbnails(): Promise<void> {
		await this.thumbnailController.updateThumbnailsByDirectory(this.props.directory)
	}

	async getThumbnails(): Promise<Buffer> {
		return await this.thumbnailController.getAllThumbnailsPack()
	}

	async getNames(): Promise<string[]> {
		return (await Fs.readdir(this.props.directory)).sort() // they are also sorted in thumbnail controller
	}

	async getFullPicture(fileName: string): Promise<Buffer> {
		const path = Path.resolve(this.props.directory, fileName)
		if(!isPathInsidePath(path, this.props.directory)){
			throw new Error("Relative paths are not allowed")
		}
		return await Fs.readFile(path)
	}
}