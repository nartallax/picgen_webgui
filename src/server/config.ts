import {GenParameterDefinition, justForRuntyper} from "common/common_types"
import {CLIArgs, getCliArgs} from "server/cli_args"
import {promises as Fs} from "fs"
import {Runtyper} from "@nartallax/runtyper"

interface ConfigFile {
	readonly dbFilePath: string
	readonly generationParameters: readonly GenParameterDefinition[]
	readonly tags: {
		readonly shape: readonly string[]
		readonly content: {readonly [tagContent: string]: readonly string[]}
	}
}

export type Config = CLIArgs & ConfigFile

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

	config = {
		...args,
		...newConfig
	}
}