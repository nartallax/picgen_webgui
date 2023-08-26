import * as ChildProcess from "child_process"
import * as ReadLine from "readline"
import * as Stream from "stream"
import * as ShellQuote from "shell-quote"
import {Config} from "server/config"
import {log} from "server/log"
import {ApiError} from "common/infra_entities/api_error"
import {ServerGenerationTaskInputData} from "server/entities/generation_task_dao"
import {GenerationTask} from "common/entities/generation_task"
import {Picture} from "common/entities/picture"
import {GenerationTaskArgument} from "common/entities/arguments"

type OutputLine = GeneratedFileLine | ErrorLine | ExpectedPicturesLine | MessageLine | ModifyTaskArguments | TimeLeftLine

interface GeneratedFileLine {
	generatedPicture: string
	modifiedArguments?: Picture["modifiedArguments"]
}
function isGeneratedFileLine(line: OutputLine): line is GeneratedFileLine {
	return typeof((line as GeneratedFileLine).generatedPicture) === "string"
}

interface ErrorLine {
	error: string
	displayFor?: number
}
function isErrorLine(line: OutputLine): line is ErrorLine {
	return typeof((line as ErrorLine).error) === "string"
}

interface MessageLine {
	message: string
	displayFor?: number
}
function isMessageLine(line: OutputLine): line is MessageLine {
	return typeof((line as MessageLine).message) === "string"
}

interface ExpectedPicturesLine {
	willGenerateCount: number
}
function isExpectedPicturesLine(line: OutputLine): line is ExpectedPicturesLine {
	return typeof((line as ExpectedPicturesLine).willGenerateCount) === "number"
}

interface ModifyTaskArguments {
	modifyTaskArguments: Record<string, GenerationTaskArgument>
}
function isModifyTaskArgumentsLine(line: OutputLine): line is ModifyTaskArguments {
	return typeof((line as ModifyTaskArguments).modifyTaskArguments) === "object"
}

interface TimeLeftLine {
	timeLeft: number
}
function isTimeLeftLine(line: OutputLine): line is TimeLeftLine {
	return typeof((line as TimeLeftLine).timeLeft) === "number"
}

export interface GenRunnerCallbacks {
	onTaskArgumentsModified(args: Record<string, GenerationTaskArgument>): void
	onFileProduced(path: string, modifiedArguments: Picture["modifiedArguments"]): void
	onExpectedPictureCountKnown(expectedPictureCount: number): void
	onMessage(message: string, displayFor: number | null): void
	onErrorMessage(message: string, displayFor: number | null): void
	onTimeLeftKnown(timeLeft: number): void
}

export interface GenRunExitResult {
	code: number
}

export class GenRunner {

	public readonly process: ChildProcess.ChildProcessByStdio<null, Stream.Readable, null>

	private readonly exitPromise: Promise<GenRunExitResult>

	constructor(
		private readonly config: Config,
		private readonly callbacks: GenRunnerCallbacks,
		public inputData: ServerGenerationTaskInputData,
		public task: GenerationTask
	) {
		const {bin, params, inputJson} = this.makeCommand(inputData)

		const process = this.process = ChildProcess.spawn(bin, params, {
			stdio: ["inherit", "pipe", "inherit"]
		})

		this.exitPromise = new Promise<GenRunExitResult>(ok => {
			process.on("exit", code => {
				log("Generator process exited with code " + code)
				ok({code: code ?? 0})
			})
		})

		process.on("error", err => {
			log("Process errored (launched with params " + inputJson + "): " + err)
		})

		this.addStdoutParser()
	}

	waitCompletion(): Promise<GenRunExitResult> {
		return this.exitPromise
	}

	private async onFileProduced(line: GeneratedFileLine, modifiedArguments: Picture["modifiedArguments"]): Promise<void> {
		this.callbacks.onFileProduced(line.generatedPicture, modifiedArguments)
	}

	private addStdoutParser(): void {
		const reader = ReadLine.createInterface(this.process.stdout)
		reader.on("line", async lineStr => {
			try {
				if(!lineStr.startsWith("{")){
					log(lineStr)
					return
				}
				let line: OutputLine
				try {
					line = JSON.parse(lineStr)
				} catch(e){
					log("Failed to parse json-like line " + lineStr + ". Skipping it.")
					return
				}
				if(isErrorLine(line)){
					this.callbacks.onErrorMessage(line.error, line.displayFor ?? null)
				} else if(isMessageLine(line)){
					this.callbacks.onMessage(line.message, line.displayFor ?? null)
				} else if(isGeneratedFileLine(line)){
					await this.onFileProduced(line, line.modifiedArguments ?? null)
				} else if(isExpectedPicturesLine(line)){
					this.callbacks.onExpectedPictureCountKnown(line.willGenerateCount)
				} else if(isModifyTaskArgumentsLine(line)){
					this.callbacks.onTaskArgumentsModified(line.modifyTaskArguments)
				} else if(isTimeLeftLine(line)){
					this.callbacks.onTimeLeftKnown(line.timeLeft)
				} else {
					console.error("Unknown action in line " + lineStr + ". Skipping it.")
				}
			} catch(e){
				log("Error processing generator stdout output: " + e)
			}
		})
	}

	private makeCommand(task: ServerGenerationTaskInputData): {bin: string, params: readonly string[], inputJson: string} {
		const json = JSON.stringify(task.arguments)

		const paramSet = this.config.parameterSets.find(set => set.internalName === task.paramSetName)
		if(!paramSet){
			throw new Error(`No param set named ${task.paramSetName}! This should be caught at validation phase.`)
		}

		const entries = ShellQuote.parse(paramSet.commandTemplate, {
			INPUT_JSON: json,
			PARAM_SET: task.paramSetName
		})

		for(const entry of entries){
			if(typeof(entry) !== "string"){
				throw new ApiError("misconfiguration", "Bad config: launch command contains too complex parts to be processed")
			}
		}

		if(entries.length === 0){
			throw new ApiError("misconfiguration", "Bad config: generation command is wut?!")
		}

		const bin = entries[0] as string
		const params = entries.slice(1) as string[]
		return {bin, params, inputJson: json}
	}

	kill(): void {
		this.process.kill()
	}

}