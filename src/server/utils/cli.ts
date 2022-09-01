import * as Path from "path"

interface CliBaseArgDef<V> {
	readonly default?: V
	readonly keys: string[]
	readonly definition?: string
}

interface CliBoolArgDef extends CliBaseArgDef<boolean>{
	readonly type: "bool"
	readonly isHelp?: boolean
	readonly allowedValues?: readonly boolean[] // just for sake of completeness
}

interface CliStringArgDef<T extends string = string> extends CliBaseArgDef<T>{
	readonly type: "string" | "path"
	readonly allowedValues?: readonly T[]
}

interface CliNumberArgDef extends CliBaseArgDef<number>{
	readonly type: "int" | "double"
	readonly allowedValues?: readonly number[]
}

interface CliStringArrArgDef<T extends string = string> extends CliBaseArgDef<readonly T[]>{
	readonly type: "array of path" | "array of string"
	readonly allowedValues?: readonly T[]
}

interface CliNumberArrArgDef extends CliBaseArgDef<readonly number[]>{
	readonly type: "array of int" | "array of double"
	readonly allowedValues?: readonly number[]
}

type CliArgDef =
	| CliBoolArgDef
	| CliStringArgDef
	| CliNumberArgDef
	| CliStringArrArgDef
	| CliNumberArrArgDef

function isArrayArgDef(def: CliArgDef): def is CliStringArrArgDef | CliNumberArrArgDef {
	return [
		"array of string",
		"array of path",
		"array of int",
		"array of double"
	].includes(def.type)
}

export type CliArgType<T> = T extends CliBaseArgDef<infer V> ? V : never
export type CliArgObject<C> = C extends CLI<infer T> ? {readonly [k in keyof T]: T[k]} : never

export interface CliParams<T> {
	readonly helpHeader?: string
	displayUserError?(e: Error): never
	displayHelp?(lines: string[]): never
	readonly pathResolveBase?: string
	readonly definition: {readonly [k in keyof(T)]: CliArgDef & CliBaseArgDef<T[k]>}
}

export class CLI<T> {

	static get processArgvWithoutExecutables(): readonly string[] {
		return process.argv.slice(2)
	}

	static defaultHelpPrinter(lines: string[]): never {
		lines.forEach(line => console.error(line))
		process.exit(1)
	}

	static defaultErrorHandler(error: Error): never {
		console.error(error.message)
		process.exit(1)
	}

	static path(params: {keys: string | readonly string[], definition?: string, allowedValues?: readonly string[], default?: string}): CliStringArgDef {
		return {
			default: params.default,
			keys: Array.isArray(params.keys) ? params.keys : [params.keys],
			allowedValues: params.allowedValues,
			definition: params.definition,
			type: "path"
		}
	}

	static str<T extends string = string>(params: {keys: string | readonly string[], definition?: string, allowedValues?: readonly T[], default?: T}): CliStringArgDef<T> {
		return {
			default: params.default,
			keys: Array.isArray(params.keys) ? params.keys : [params.keys],
			allowedValues: params.allowedValues,
			definition: params.definition,
			type: "string"
		}
	}

	static bool(params: {keys: string | readonly string[], definition?: string}): CliBoolArgDef {
		return {
			default: false,
			keys: Array.isArray(params.keys) ? params.keys : [params.keys],
			definition: params.definition,
			type: "bool"
		}
	}

	static help(params: {keys: string | readonly string[], definition?: string}): CliBoolArgDef {
		return {
			default: false,
			keys: Array.isArray(params.keys) ? params.keys : [params.keys],
			definition: params.definition,
			isHelp: true,
			type: "bool"
		}
	}

	static double(params: {keys: string | string[], definition?: string, allowedValues?: number[], default?: number}): CliNumberArgDef {
		return {
			default: params.default,
			keys: Array.isArray(params.keys) ? params.keys : [params.keys],
			allowedValues: params.allowedValues,
			definition: params.definition,
			type: "double"
		}
	}

	static int(params: {keys: string | string[], definition?: string, allowedValues?: number[], default?: number}): CliNumberArgDef {
		return {
			default: params.default,
			keys: Array.isArray(params.keys) ? params.keys : [params.keys],
			allowedValues: params.allowedValues,
			definition: params.definition,
			type: "int"
		}
	}

	static pathArr(params: {keys: string | readonly string[], definition?: string, allowedValues?: readonly string[], default?: readonly string[]}): CliStringArrArgDef {
		return {
			default: params.default,
			keys: Array.isArray(params.keys) ? params.keys : [params.keys],
			allowedValues: params.allowedValues,
			definition: params.definition,
			type: "array of path"
		}
	}

	static strArr<T extends string = string>(params: {keys: string | readonly string[], definition?: string, allowedValues?: readonly T[], default?: readonly T[]}): CliStringArrArgDef {
		return {
			default: params.default,
			keys: Array.isArray(params.keys) ? params.keys : [params.keys],
			allowedValues: params.allowedValues,
			definition: params.definition,
			type: "array of string"
		}
	}

	static intArr(params: {keys: string | readonly string[], definition?: string, allowedValues?: readonly number[], default?: readonly number[]}): CliNumberArrArgDef {
		return {
			default: params.default,
			keys: Array.isArray(params.keys) ? params.keys : [params.keys],
			allowedValues: params.allowedValues,
			definition: params.definition,
			type: "array of int"
		}
	}

	static doubleArr(params: {keys: string | readonly string[], definition?: string, allowedValues?: readonly number[], default?: readonly number[]}): CliNumberArrArgDef {
		return {
			default: params.default,
			keys: Array.isArray(params.keys) ? params.keys : [params.keys],
			allowedValues: params.allowedValues,
			definition: params.definition,
			type: "array of double"
		}
	}

	readonly params: CliParams<T>

	constructor(params: CliParams<T>) {
		this.params = params
	}

	private fail(msg: string): never {
		return (this.params.displayUserError || CLI.defaultErrorHandler)(new Error(msg))
	}

	private printHelp(): never {
		const helpLines = this.params.helpHeader ? [this.params.helpHeader] : []

		const argNames = Object.keys(this.params.definition) as (string & keyof(T))[]

		const keyPart = (argName: string & keyof(T)) => {
			const def = this.params.definition[argName]
			return def.keys.join(", ") + " (" + def.type + ")"
		}

		const maxKeyLength: number = argNames.map(argName => keyPart(argName).length).reduce((a, b) => Math.max(a, b), 0) + 1

		argNames.forEach(argName => {
			const def = this.params.definition[argName]
			let line = keyPart(argName)
			while(line.length < maxKeyLength){
				line += " "
			}
			if(def.definition){
				line += ": " + def.definition
			}
			if(def.allowedValues){
				if(def.definition){
					line += ";"
				}
				line += " allowed values: " + def.allowedValues.join(", ")
			}
			helpLines.push(line)
		})

		const handler = this.params.displayHelp || CLI.defaultHelpPrinter
		return handler(helpLines)
	}

	private buildKeysMap(): Map<string, string & keyof(T)> {
		const result = new Map<string, string & keyof(T)>()
		const knownNames = new Set<string & keyof(T)>();
		(Object.keys(this.params.definition) as (string & keyof(T))[]).forEach(argName => {
			const keys = this.params.definition[argName].keys
			if(keys.length === 0){
				throw new Error(`CLI argument "${argName}" has no keys with which it could be passed.`)
			}

			if(knownNames.has(argName)){
				throw new Error(`CLI argument "${argName}" is mentioned twice in arguments description.`)
			}
			knownNames.add(argName)

			keys.forEach(key => {
				if(result.has(key)){
					throw new Error(`CLI argument key "${key}" is bound to more than one argument: "${argName}", "${result.get(key)}".`)
				}
				result.set(key, argName)
			})
		})

		return result
	}

	/** Main method of the class.
	 * Parses value from arguments, puts them into object, validates them.
	 * If there's user error - displays it and exits.
	 * If there's help flag - displays help and exits. */
	parseArgs(values: readonly string[] = CLI.processArgvWithoutExecutables): CliArgObject<this> {
		return this.finalize(this.extract(values)) as CliArgObject<this>
	}

	/** Transform array of raw CLI arguments into object */
	private extract(values: readonly string[]): Record<keyof T, unknown> {
		const knownArguments = new Set<keyof(T)>()
		const keyToArgNameMap = this.buildKeysMap()

		const result = {} as Record<keyof T, unknown>

		for(let i = 0; i < values.length; i++){
			const v = values[i]!
			if(!keyToArgNameMap.has(v)){
				this.fail("Unknown CLI argument key: \"" + v + "\".")
			}

			const argName = keyToArgNameMap.get(v) as string & keyof(T)
			const def = this.params.definition[argName]
			const isArray = isArrayArgDef(def)
			if(knownArguments.has(argName) && !isArray){
				this.fail(`CLI argument "${argName}" passed more than once, last time with key "${v}". This parameter is not array parameter and expected no more than one value.`)
			}
			knownArguments.add(argName)

			let actualValue: unknown
			if(def.type === "bool"){
				actualValue = true
			} else {
				if(i === values.length - 1){
					this.fail("Expected to have some value after CLI key \"" + v + "\".")
				}
				i++

				switch(def.type){
					case "int":
					case "array of int":
						actualValue = this.extractIntFrom(values[i]!)
						break
					case "double":
					case "array of double":
						actualValue = this.extractDoubleFrom(values[i]!)
						break
					case "string":
					case "array of string":
						actualValue = values[i]!
						break
					case "path":
					case "array of path":
						actualValue = this.extractPathFrom(values[i]!)
						break
					default:
						throw new Error(`Unexpected argument value type: ${(def as CliArgDef).type}`)
				}

				const allowedValues = def.allowedValues as unknown[] | undefined
				if(allowedValues && allowedValues.indexOf(actualValue) < 0){
					this.fail(`Value of CLI argument "${argName}" is not in allowed values set: it's "${values[i]}", while allowed values are ${allowedValues.map(x => "\"" + x + "\"").join(", ")}`)
				}

				if(isArray){
					const arr = (result[argName] as unknown[]) || []
					arr.push(actualValue)
					actualValue = arr
				}
			}

			result[argName] = actualValue
		}

		return result
	}

	private extractIntFrom(argValue: string): number {
		const num = this.extractDoubleFrom(argValue)
		if((num % 1) !== 0){
			this.fail(`Expected "${argValue}" to be an integer number, but it's not.`)
		}
		return num
	}

	private extractDoubleFrom(argValue: string): number {
		const num = parseFloat(argValue as string)
		if(!Number.isFinite(num)){
			this.fail(`Expected "${argValue}" to be a finite number, but it's not.`)
		}
		return num
	}

	private extractPathFrom(argValue: string): string {
		return Path.resolve(
			this.params.pathResolveBase || ".",
			argValue
		)
	}


	/** Check everything that was not checked until this point, and process help if any */
	private finalize(result: Record<keyof T, unknown>): T {
		const abstentMandatories: string[] = []
		let haveHelp = false;
		(Object.keys(this.params.definition) as (string & keyof(T))[]).forEach(argName => {
			const def = this.params.definition[argName]

			if(def.type === "bool" && def.isHelp && !!result[argName]){
				haveHelp = true
			}

			if(argName in result){
				return
			}

			if(def.default !== undefined){
				result[argName] = def.default
				if(def.type === "path"){
					result[argName] = this.extractPathFrom(result[argName] as string)
				} else if(def.type === "array of path"){
					result[argName] = (result[argName] as string[])
						.map(defaultPath => this.extractPathFrom(defaultPath))
				}
			} else {
				abstentMandatories.push(argName)
			}
		})

		if(haveHelp){
			this.printHelp()
		}

		if(abstentMandatories.length > 0){
			this.fail("Some mandatory CLI arguments are absent: " + abstentMandatories.map(x => "\"" + x + "\"").join(", "))
		}

		return result as T
	}



}