import {JsonFileList, JsonFileListItemDescription, JsonFileListItemDescriptionFile} from "common/entities/json_file_list"
import {promises as Fs} from "fs"
import * as Path from "path"
import {RCV} from "@nartallax/ribcage-validation"
import watch from "node-watch"
import {RunOnlyOneAtTimeFn, runOnlyOneAtTime} from "common/utils/run_only_one_at_time"
import {log} from "server/log"
import {JsonFileListGenParam} from "common/entities/parameter"
import {md5} from "common/utils/md5"
import {config, websocketServer} from "server/server_globals"

const jsonListItemFileValidator = RCV.getValidatorBuilder().build(JsonFileListItemDescriptionFile)

type ListDescription = {
	paramSetName: string
	paramName: string
	id: string
	directory: string
	siblingExt?: string
}

type List = ListDescription & {
	watcher: ReturnType<typeof watch> | null
	values: readonly JsonFileListItemDescription[]
	reload: RunOnlyOneAtTimeFn
}

export class JSONFileListController {
	readonly name = "JSON file list"

	private lists: ReadonlyMap<string, List> = new Map()

	private getListDescriptions(): ListDescription[] {
		return config.parameterSets.flatMap(paramSet =>
			paramSet.parameterGroups.flatMap(group =>
				group.parameters
					.filter((param): param is JsonFileListGenParam => param.type === "json_file_list")
					.map(param => {
						const relDir = Path.relative(".", param.directory)
						const dirHash = md5(relDir)
						param.directory = dirHash
						return {
							paramSetName: paramSet.internalName,
							paramName: param.jsonName,
							directory: relDir,
							id: dirHash,
							siblingExt: param.siblingFileExtension
						}
					})
			)
		)
	}

	async start(): Promise<void> {
		this.lists = new Map(this.getListDescriptions().map(listDescription => {
			const list: List = {
				...listDescription,
				values: [],
				watcher: null,
				reload: runOnlyOneAtTime(async() => {
					list.values = await this.readFiles(listDescription.directory, listDescription.siblingExt)
				})
			}
			return [list.id, list]
		}))

		for(const list of this.lists.values()){
			this.trySetupWatcher(list)
			await list.reload()
		}
	}

	stop(): void {
		for(const list of this.lists.values()){
			if(list.watcher){
				list.watcher.close()
				list.watcher = null
			}
		}
	}

	getAllLists(): readonly JsonFileList[] {
		return [...this.lists.values()].map(list => ({
			directory: list.id,
			items: list.values
		}))
	}

	private trySetupWatcher(list: List): void {
		if(list.watcher){
			return
		}
		list.watcher = watch(
			list.directory,
			{filter: /.json$/i, recursive: false, delay: 100, persistent: false},
			async() => {
				const callCount = list.reload.callCount
				await list.reload()
				if(list.reload.callCount !== callCount + 1){
					// we already reading this for next time, will send notifications then
					return
				}

				log(`Changes detected in json file list directory ${list.directory}; sending updates.`)
				websocketServer.sendToAll({
					type: "json_file_list_update",
					directory: list.directory,
					items: list.values
				})
			}
		)
	}

	private async readFiles(directory: string, siblingExt: string | undefined): Promise<JsonFileListItemDescription[]> {
		const result: JsonFileListItemDescription[] = []

		const files = (await Fs.readdir(directory))
			.map(filename => Path.resolve(directory, filename))
		const fileSet = new Set(files)

		for(const filePath of files){
			if(!filePath.toLowerCase().endsWith(".json")){
				continue
			}

			const id = Path.basename(filePath).replace(/\.json$/i, "")

			if(siblingExt){
				const siblingFile = Path.resolve(directory, id + siblingExt)
				if(!fileSet.has(siblingFile)){
					throw new Error(`Expected json list file ${filePath} to have related sibling file at ${siblingFile}, but it's not there.`)
				}
			}

			let fileJson: any
			try {
				fileJson = JSON.parse(await Fs.readFile(filePath, "utf-8"))
			} catch(e){
				throw new Error(`Failed to read/parse json list file ${filePath}: ${e}`)
			}

			jsonListItemFileValidator(fileJson)

			const listItemDescription: JsonFileListItemDescription = {
				...fileJson, id
			}
			result.push(listItemDescription)
		}

		return result
	}
}