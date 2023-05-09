import {GenerationParameterSet} from "common/common_types"
import {CLIArgs, getCliArgs} from "server/cli_args"
import {promises as Fs} from "fs"
import {RCV} from "@nartallax/ribcage-validation"
import {RC} from "@nartallax/ribcage"

interface AuxConfigFilesData {
	readonly discordClientSecret: string
	readonly tags: {
		readonly shape: readonly string[]
		readonly content: {readonly [tagContent: string]: readonly string[]}
	}
}

const ConfigFile = RC.struct(RC.structFields({
	ro: {
		pictureStorageDir: RC.string(),
		runningGenerationPictureStorageDir: RC.string(),
		haveHttps: RC.bool(),
		httpPort: RC.int(),
		discordClientId: RC.string(),
		discordClientSecretFile: RC.string(),
		deleteFilesReceivedFromGenerator: RC.bool(),
		dbFilePath: RC.string(),
		parameterSets: RC.roArray(GenerationParameterSet),
		tags: RC.struct(RC.structFields({ro: {
			shapeTagsFile: RC.string(),
			contentTagsFile: RC.string()
		}}))
	},
	roOpt: {
		httpHost: RC.string()
	}
}))

export type ConfigFile = RC.Value<typeof ConfigFile>

export type Config = CLIArgs & ConfigFile & AuxConfigFilesData

export let config: Config = null as unknown as Config

let configFileValidator: ((configFile: unknown) => void) | null = null

export async function loadConfig(): Promise<void> {

	if(!configFileValidator){
		configFileValidator = RCV.getValidatorBuilder().build(ConfigFile)
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