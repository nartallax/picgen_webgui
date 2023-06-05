import {Lora, LoraDescriptionFile} from "common/entities/lora"
import {Config, config} from "server/config"
import {promises as Fs} from "fs"
import * as Path from "path"
import {RCV} from "@nartallax/ribcage-validation"

const loreFileValidator = RCV.getValidatorBuilder().build(LoraDescriptionFile)

async function readLoras(config: Config): Promise<Lora[]> {
	const result: Lora[] = []

	const loresConfig = config.loras
	if(!loresConfig){
		return result
	}

	const files = (await Fs.readdir(loresConfig.directory))
		.map(filename => Path.resolve(loresConfig.directory, filename))
	const fileSet = new Set(files)

	for(const filePath of files){
		if(!filePath.toLowerCase().endsWith(".json")){
			continue
		}

		const id = Path.basename(filePath).replace(/\.json$/i, "")

		if(loresConfig.loraFileExtension){
			const loreFile = Path.resolve(loresConfig.directory, id + loresConfig.loraFileExtension)
			if(!fileSet.has(loreFile)){
				throw new Error(`Expected lore description ${filePath} to have related lore file at ${loreFile}, but it's not there.`)
			}
		}

		let fileJson: any
		try {
			fileJson = JSON.parse(await Fs.readFile(filePath, "utf-8"))
		} catch(e){
			throw new Error(`Failed to read/parse lore description file ${filePath}: ${e}`)
		}

		loreFileValidator(fileJson)

		const lore: Lora = {
			...fileJson, id
		}
		result.push(lore)
	}

	return result
}


let lores: readonly Lora[] | null = null
export async function getLoras(): Promise<readonly Lora[]> {
	return lores ||= await readLoras(config)
}