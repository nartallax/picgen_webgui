import {GenParameterDefinition, justForRuntyper} from "common/common_types"
import {CLIArgs, getCliArgs} from "server/cli_args"
import {promises as Fs} from "fs"
import {Runtyper} from "@nartallax/runtyper"

interface AuxConfigFilesData {
	readonly discordClientSecret: string
	readonly tags: {
		readonly shape: readonly string[]
		readonly content: {readonly [tagContent: string]: readonly string[]}
	}
}

interface ConfigFile {
	readonly pictureStorageDir: string
	readonly runningGenerationPictureStorageDir: string
	readonly haveHttps: boolean
	readonly httpHost?: string
	readonly httpPort: number
	readonly discordClientId: string
	readonly discordClientSecretFile: string
	readonly deleteFilesReceivedFromGenerator: boolean
	readonly generationCommandTemplate: string
	readonly dbFilePath: string
	readonly generationParameters: readonly GenParameterDefinition[]
	readonly tags: {
		readonly shapeTagsFile: string
		readonly contentTagsFile: string
	}
}

export type Config = CLIArgs & ConfigFile & AuxConfigFilesData

export let config: Config = null as unknown as Config

let configFileValidator: ((configFile: unknown) => void) | null = null
void justForRuntyper

export async function loadConfig(): Promise<void> {

	if(!configFileValidator){
		configFileValidator = Runtyper.getValidatorBuilder().build(Runtyper.getSimplifier().simplify(Runtyper.getType<ConfigFile>()))
	}

	const args = getCliArgs()
	const newConfig: ConfigFile = JSON.parse(await Fs.readFile(args.paramsConfig, "utf-8"))
	configFileValidator(newConfig)

	const [discordClientSecret, shapeTagsJson, contentTagsJson] = await Promise.all([
		Fs.readFile(newConfig.discordClientSecretFile, "utf-8"),
		Fs.readFile(newConfig.tags.shapeTagsFile, "utf-8"),
		Fs.readFile(newConfig.tags.contentTagsFile, "utf-8")
	])

	config = {
		...args,
		...newConfig,
		discordClientSecret: discordClientSecret.trim(),
		tags: {
			...newConfig.tags,
			content: JSON.parse(contentTagsJson),
			shape: JSON.parse(shapeTagsJson)
		}
	}
}