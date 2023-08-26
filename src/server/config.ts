import {CLIArgs, getCliArgs} from "server/cli_args"
import {promises as Fs} from "fs"
import {RCV} from "@nartallax/ribcage-validation"
import {RC} from "@nartallax/ribcage"
import {GenerationParameterSet} from "common/entities/parameter"

interface AuxConfigFilesData {
	readonly discordClientSecret: string
}

const ConfigFile = RC.struct(RC.structFields({
	ro: {
		userControl: RC.bool(),
		pictureStorageDir: RC.string(),
		runningGenerationPictureStorageDir: RC.string(),
		haveHttps: RC.bool(),
		httpPort: RC.int(),
		discordClientId: RC.string(),
		discordClientSecretFile: RC.string(),
		resultingPictureReceivingStrategy: RC.constUnion([
			"move",
			"copy",
			"refer"
		]),
		dbFilePath: RC.string(),
		parameterSets: RC.roArray(GenerationParameterSet),
		thumbnails: RC.roStruct({
			directory: RC.string(),
			height: RC.int()
		}),
		pictureCleanup: RC.roStruct({
			resultPictureLimitPerUser: RC.int()
		})
	},
	roOpt: {
		httpHost: RC.string()
	}
}))

export type ConfigFile = RC.Value<typeof ConfigFile>

export type Config = CLIArgs & ConfigFile & AuxConfigFilesData

let configFileValidator: ((configFile: unknown) => void) | null = null

export async function loadConfig(): Promise<Config> {

	if(!configFileValidator){
		configFileValidator = RCV.getValidatorBuilder().build(ConfigFile)
	}

	const args = getCliArgs()
	const newConfig: ConfigFile = JSON.parse(await Fs.readFile(args.paramsConfig, "utf-8"))
	configFileValidator(newConfig)

	const discordClientSecret = await Fs.readFile(newConfig.discordClientSecretFile, "utf-8")

	return {
		...args,
		...newConfig,
		discordClientSecret: discordClientSecret.trim()
	}
}