import {LoraDescription, LoraDescriptionFile} from "common/entities/lora"
import {Config, config} from "server/config"
import {promises as Fs} from "fs"
import * as Path from "path"
import {RCV} from "@nartallax/ribcage-validation"
import watch from "node-watch"
import {UserlessContextFactory} from "server/request_context"
import {RunOnlyOneAtTimeFn, runOnlyOneAtTime} from "common/utils/run_only_one_at_time"
import {log} from "server/log"

const loraFileValidator = RCV.getValidatorBuilder().build(LoraDescriptionFile)

export class LoraController {

	private watcher: ReturnType<typeof watch> | null = null
	private loras: readonly LoraDescription[]
	private reloadLoras: RunOnlyOneAtTimeFn

	constructor(private readonly contextFactory: UserlessContextFactory) {
		this.reloadLoras = runOnlyOneAtTime(async() => {
			this.loras = await this.readLoras(config)
		})
		this.loras = []
	}

	async start(): Promise<void> {
		this.trySetupWatcher()
		await this.reloadLoras()
	}

	stop(): void {
		if(this.watcher){
			this.watcher.close()
			this.watcher = null
		}
	}

	getLoras(): readonly LoraDescription[] {
		return this.loras
	}

	private trySetupWatcher(): void {
		if(this.watcher || !config.loras){
			return
		}
		this.watcher = watch(
			config.loras.directory,
			{filter: /.json$/i, recursive: false, delay: 100, persistent: false},
			async() => {
				const callCount = this.reloadLoras.callCount
				await this.reloadLoras()
				if(this.reloadLoras.callCount !== callCount + 1){
					// we already reading this for next time, will send notifications then
					return
				}

				log("Changes detected in lora directory; sending updates.")
				this.contextFactory(context => {
					context.websockets.sendToAll({
						type: "lora_description_update",
						newLoraDescriptions: this.loras
					})
				})
			}
		)
	}

	private async readLoras(config: Config): Promise<LoraDescription[]> {
		const result: LoraDescription[] = []

		const lorasConfig = config.loras
		if(!lorasConfig){
			return result
		}

		const files = (await Fs.readdir(lorasConfig.directory))
			.map(filename => Path.resolve(lorasConfig.directory, filename))
		const fileSet = new Set(files)

		for(const filePath of files){
			if(!filePath.toLowerCase().endsWith(".json")){
				continue
			}

			const id = Path.basename(filePath).replace(/\.json$/i, "")

			if(lorasConfig.loraFileExtension){
				const loraFile = Path.resolve(lorasConfig.directory, id + lorasConfig.loraFileExtension)
				if(!fileSet.has(loraFile)){
					throw new Error(`Expected lora description ${filePath} to have related lora file at ${loraFile}, but it's not there.`)
				}
			}

			let fileJson: any
			try {
				fileJson = JSON.parse(await Fs.readFile(filePath, "utf-8"))
			} catch(e){
				throw new Error(`Failed to read/parse lora description file ${filePath}: ${e}`)
			}

			loraFileValidator(fileJson)

			const lora: LoraDescription = {
				...fileJson, id
			}
			result.push(lora)
		}

		return result
	}
}