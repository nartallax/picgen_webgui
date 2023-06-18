import {JsonFileList, JsonFileListItemDescription, JsonFileListItemDescriptionFile, makeJsonFileListName} from "common/entities/json_file_list"
import {config} from "server/config"
import {promises as Fs} from "fs"
import * as Path from "path"
import {RCV} from "@nartallax/ribcage-validation"
import watch from "node-watch"
import {UserlessContextFactory} from "server/request_context"
import {RunOnlyOneAtTimeFn, runOnlyOneAtTime} from "common/utils/run_only_one_at_time"
import {log} from "server/log"
import {JsonFileListGenParam} from "common/entities/parameter"

const jsonListItemFileValidator = RCV.getValidatorBuilder().build(JsonFileListItemDescriptionFile)

type ListDescription = {
	name: string
	paramSetName: string
	paramName: string
	directory: string
	siblingExt?: string
}

type List = ListDescription & {
	watcher: ReturnType<typeof watch> | null
	values: readonly JsonFileListItemDescription[]
	reload: RunOnlyOneAtTimeFn
}

export class JSONFileListController {

	private lists: ReadonlyMap<string, List>

	constructor(private readonly contextFactory: UserlessContextFactory) {
		this.lists = new Map(this.getListDescriptions().map(listDescription => {
			const list: List = {
				...listDescription,
				values: [],
				watcher: null,
				reload: runOnlyOneAtTime(async() => {
					list.values = await this.readFiles(listDescription.directory, listDescription.siblingExt)
				})
			}
			return [list.name, list]
		}))
	}

	private getListDescriptions(): ListDescription[] {
		const allLists = config.parameterSets.flatMap(paramSet =>
			paramSet.parameterGroups.flatMap(group =>
				group.parameters
					.filter((param): param is JsonFileListGenParam => param.type === "json_file_list")
					.map(param => ({
						name: makeJsonFileListName(paramSet.internalName, param.jsonName),
						paramSetName: paramSet.internalName,
						paramName: param.jsonName,
						directory: param.directory,
						siblingExt: param.siblingFileExtension
					}))
			)
		)

		const uniqLists = [...new Map(allLists.map(list =>
			[makeJsonFileListName(list.paramSetName, list.paramName), list]
		)).values()]

		return uniqLists
	}

	async start(): Promise<void> {
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

	getList(paramSetName: string, paramName: string): readonly JsonFileListItemDescription[] {
		const name = makeJsonFileListName(paramSetName, paramName)
		const list = this.lists.get(name)
		if(!list){
			throw new Error(`There is no json file list for paramSetName = ${paramSetName} and paramName = ${paramName}`)
		}
		return list.values
	}

	getAllLists(): readonly JsonFileList[] {
		return [...this.lists.values()].map(list => ({
			paramSetName: list.paramSetName,
			paramName: list.paramName,
			items: list.values
		}))
	}

	private trySetupWatcher(list: List): void {
		if(list.watcher){
			return
		}
		// TODO: shared watchers, in case some lists refer to same directory
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
				this.contextFactory(context => {
					context.websockets.sendToAll({
						type: "json_file_list_update",
						paramSetName: list.paramSetName,
						paramName: list.paramName,
						items: list.values
					})
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