import {GenParameterDefinition, justForRuntyper} from "common/common_types"
import {CLIArgs, getCliArgs} from "server/cli_args"
import {promises as Fs} from "fs"
import {Runtyper} from "@nartallax/runtyper"

interface AuxConfigFilesData {
	readonly discordClientSecret: string
}

interface ConfigFile {
	readonly pictureStorageDir: string
	readonly defaultToHttps: boolean
	readonly discordClientId: string
	readonly discordClientSecretFile: string
	readonly deleteFilesReceivedFromGenerator: boolean
	readonly generationCommandTemplate: string
	readonly dbFilePath: string
	readonly discordLoginUrl: string
	readonly generationParameters: readonly GenParameterDefinition[]
	readonly tags: {
		readonly shape: readonly string[]
		readonly content: {readonly [tagContent: string]: readonly string[]}
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

	const discordClientSecret = (await Fs.readFile(newConfig.discordClientSecretFile, "utf-8")).trim()

	config = {
		...args,
		...newConfig,
		discordClientSecret
	}
}