import {Lore, LoreDescriptionFile} from "common/entities/lore"
import {Config, config} from "server/config"
import {promises as Fs} from "fs"
import * as Path from "path"
import {RCV} from "@nartallax/ribcage-validation"

const loreFileValidator = RCV.getValidatorBuilder().build(LoreDescriptionFile)

async function readLores(config: Config): Promise<Lore[]> {
	const result: Lore[] = []

	const loresConfig = config.lores
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

		if(loresConfig.loreFileExtension){
			const loreFile = Path.resolve(loresConfig.directory, id + loresConfig.loreFileExtension)
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

		const lore: Lore = {
			...fileJson, id
		}
		result.push(lore)
	}

	return result
}


let lores: readonly Lore[] | null = null
export async function getLores(): Promise<readonly Lore[]> {
	return lores ||= await readLores(config)
}