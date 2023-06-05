import {LoraDescription, LoraDescriptionFile} from "common/entities/lora"
import {Config, config} from "server/config"
import {promises as Fs} from "fs"
import * as Path from "path"
import {RCV} from "@nartallax/ribcage-validation"

const loraFileValidator = RCV.getValidatorBuilder().build(LoraDescriptionFile)

async function readLoras(config: Config): Promise<LoraDescription[]> {
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


let loras: readonly LoraDescription[] | null = null
export async function getLoras(): Promise<readonly LoraDescription[]> {
	return loras ||= await readLoras(config)
}