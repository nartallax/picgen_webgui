import {CLIArgs, getCliArgs} from "server/cli_args"
import {promises as Fs} from "fs"
import {RCV, ValidationError} from "@nartallax/ribcage-validation"
import {RC} from "@nartallax/ribcage"
import {GenParameter, GenParameterGroup, GenerationParameterSet} from "common/entities/parameter"

interface AuxConfigFilesData {
	readonly discordClientSecret: string
}

export type ConfigFile = RC.Value<typeof ConfigFile>
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
		parameterSets: RC.roArray(GenerationParameterSet, {validators: [
			sets => {
				const defaultRedrawParams = sets
					.flatMap(set => set.parameterGroups)
					.flatMap(group => group.parameters)
					.filter(param => param.type === "picture" && param.isDefaultRedraw)
				if(defaultRedrawParams.length > 1){
					throw new Error("It is not allowed to have more than one isDefaultRedraw parameter in the whole config.")
				}
				return true
			}
		]}),
		thumbnails: RC.roStruct({
			directory: RC.string(),
			height: RC.int()
		}),
		pictureCleanup: RC.roStruct({
			resultPictureLimitPerUser: RC.int()
		}),
		userStatic: RC.roStruct({
			directory: RC.string(),
			thumbnails: RC.roStruct({
				directory: RC.string(),
				height: RC.int()
			})
		})
	},
	roOpt: {
		httpHost: RC.string()
	}
}))

let rawIncludeValidator: ((x: unknown) => ValidationError | null) | null = null
const isInclude = (x: unknown): x is ConfigInclude => {
	rawIncludeValidator ??= RCV.getValidatorBuilder().buildNonThrowing(ConfigInclude)
	return rawIncludeValidator(x) ? false : true
}
export type ConfigInclude = RC.Value<typeof ConfigInclude>
export const ConfigInclude = RC.roStruct({
	include: RC.string()
})

type ParameterGroupWithIncludes = Omit<GenParameterGroup, "parameters"> & {
	parameters: (GenParameterGroup["parameters"][number] | ConfigInclude)[]
}
type ParameterSetWithIncludes = Omit<GenerationParameterSet, "parameterGroups"> & {
	extends?: string
	parameterGroups: (GenerationParameterSet["parameterGroups"][number] | ParameterGroupWithIncludes | ConfigInclude)[]
}
type ConfigWithIncludes = Omit<ConfigFile, "parameterSets"> & {
	parameterSets: (ConfigFile["parameterSets"][number] | ParameterSetWithIncludes | ConfigInclude)[]
}

export type Config = CLIArgs & ConfigFile & AuxConfigFilesData

export async function loadConfig(): Promise<Config> {

	const args = getCliArgs()
	const configFileWithIncludes: ConfigWithIncludes = JSON.parse(await Fs.readFile(args.paramsConfig, "utf-8"))
	const configFile = await resolveConfigIncludes(configFileWithIncludes, args.paramsConfig)

	const discordClientSecret = await Fs.readFile(configFile.discordClientSecretFile, "utf-8")

	return {
		...args,
		...configFile,
		discordClientSecret: discordClientSecret.trim()
	}
}

function runValidator<T>(x: unknown, typeName: string, validator: (x: unknown) => ValidationError | null, filePath: string, includedFrom: string | null): asserts x is T {
	const error = validator(x)
	if(error){
		throw new Error(`Validation failed for file ${filePath}${!includedFrom ? "" : " (included from " + includedFrom + ")"}: expected to have proper ${typeName}, but it's not: ` + error)
	}
}

let configFileValidator: ((configFile: unknown) => void) | null = null
async function resolveConfigIncludes(config: ConfigWithIncludes, filePath: string): Promise<ConfigFile> {
	for(let i = 0; i < config.parameterSets.length; i++){
		const item = config.parameterSets[i]!
		let paramSet: GenerationParameterSet
		if(isInclude(item)){
			const file = await Fs.readFile(item.include, "utf-8")
			const paramSetWithIncludes = JSON.parse(file)
			paramSet = await resolveParamSetIncludes(paramSetWithIncludes, item.include, filePath)
		} else {
			paramSet = await resolveParamSetIncludes(item as ParameterSetWithIncludes, filePath, null)
		}
		config.parameterSets[i] = paramSet
	}

	configFileValidator ??= RCV.getValidatorBuilder().build(ConfigFile)
	configFileValidator(config)
	return config as ConfigFile
}

let paramSetValidator: ((x: unknown) => ValidationError | null) | null = null
async function resolveParamSetIncludes(paramSet: ParameterSetWithIncludes, filePath: string, includedFrom: string | null, skipValidation = false): Promise<GenerationParameterSet> {
	if(paramSet.extends){
		const file = await Fs.readFile(paramSet.extends, "utf-8")
		const paramSetBase: ParameterSetWithIncludes = JSON.parse(file)
		const resolvedParamSetBase = await resolveParamSetIncludes(paramSetBase, paramSet.extends, filePath, true)
		paramSet = {...resolvedParamSetBase, ...paramSet}
		delete paramSet.extends
	}

	for(let i = 0; i < paramSet.parameterGroups?.length ?? 0; i++){
		const item = paramSet.parameterGroups[i]!
		let paramGroup: GenParameterGroup
		if(isInclude(item)){
			const file = await Fs.readFile(item.include, "utf-8")
			const paramGroupWithIncludes: ParameterGroupWithIncludes = JSON.parse(file)
			paramGroup = await resolveParamGroupIncludes(paramGroupWithIncludes, item.include, filePath)
		} else {
			paramGroup = await resolveParamGroupIncludes(item as ParameterGroupWithIncludes, filePath, includedFrom)
		}

		paramSet.parameterGroups[i] = paramGroup
	}

	if(!skipValidation){
		paramSetValidator ??= RCV.getValidatorBuilder().buildNonThrowing(GenerationParameterSet)
		runValidator(paramSet, "parameter set", paramSetValidator, filePath, includedFrom)
	}

	return paramSet as GenerationParameterSet
}

let paramGroupValidator: ((x: unknown) => ValidationError | null) | null = null
let paramValidator: ((x: unknown) => ValidationError | null) | null = null
async function resolveParamGroupIncludes(group: ParameterGroupWithIncludes, filePath: string, includedFrom: string | null): Promise<GenParameterGroup> {
	for(let i = 0; i < group.parameters.length; i++){
		const item = group.parameters[i]!
		paramValidator ??= RCV.getValidatorBuilder().buildNonThrowing(GenParameter)
		let param: GenParameter
		if(isInclude(item)){
			const file = await Fs.readFile(item.include, "utf-8")
			param = JSON.parse(file)
			runValidator(param, "parameter", paramValidator, item.include, filePath)
		} else {
			param = item
			runValidator(param, "parameter", paramValidator, filePath, includedFrom)
		}

		group.parameters[i] = param
	}

	paramGroupValidator ??= RCV.getValidatorBuilder().buildNonThrowing(GenParameterGroup)
	runValidator<GenParameterGroup>(group, "parameter group", paramGroupValidator, filePath, includedFrom)
	return group
}