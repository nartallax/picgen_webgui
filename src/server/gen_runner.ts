import * as ChildProcess from "child_process"
import * as ReadLine from "readline"
import * as Path from "path"
import * as Stream from "stream"
import * as ShellQuote from "shell-quote"
import {promises as Fs} from "fs"
import {Config} from "server/config"
import {log} from "server/log"
import {GenerationTask} from "common/entity_types"
import {ApiError} from "common/api_error"
import {ServerGenerationTaskInputData} from "server/entities/generation_task"

type OutputLine = GeneratedFileLine | ErrorLine | ExpectedPicturesLine | MessageLine | UpdatedPromptLine

interface GeneratedFileLine {
	generatedPicture: string
}
function isGeneratedFileLine(line: OutputLine): line is GeneratedFileLine {
	return typeof((line as GeneratedFileLine).generatedPicture) === "string"
}

interface ErrorLine {
	error: string
}
function isErrorLine(line: OutputLine): line is ErrorLine {
	return typeof((line as ErrorLine).error) === "string"
}

interface MessageLine {
	message: string
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

interface UpdatedPromptLine {
	updatedPrompt: string
}
function isUpdatedPromptLine(line: OutputLine): line is UpdatedPromptLine {
	return typeof((line as UpdatedPromptLine).updatedPrompt) === "string"
}

export interface GenRunnerCallbacks {
	onPromptUpdated(newPrompt: string): void
	onFileProduced(data: Buffer, ext: string): void
	onExpectedPictureCountKnown(expectedPictureCount: number): void
	onMessage(message: string): void
	onErrorMessage(message: string): void
}

export class GenRunner {

	public readonly process: ChildProcess.ChildProcessByStdio<null, Stream.Readable, null>

	private readonly exitPromise: Promise<void>

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

		this.exitPromise = new Promise<void>(ok => {
			process.on("exit", code => {
				log("Generator process exited with code " + code)
				ok()
			})
		})

		process.on("error", err => {
			log("Process errored (launched with params " + inputJson + "): " + err)
		})

		this.addStdoutParser()
	}

	waitCompletion(): Promise<void> {
		return this.exitPromise
	}

	private async onFileProduced(line: GeneratedFileLine): Promise<void> {
		const content = await Fs.readFile(line.generatedPicture)
		const ext = Path.extname(line.generatedPicture).substring(1).toLowerCase()
		this.callbacks.onFileProduced(content, ext)

		if(this.config.deleteFilesReceivedFromGenerator){
			await Fs.rm(line.generatedPicture)
		}
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
					this.callbacks.onErrorMessage(line.error)
				} else if(isMessageLine(line)){
					this.callbacks.onErrorMessage(line.message)
				} else if(isGeneratedFileLine(line)){
					await this.onFileProduced(line)
				} else if(isExpectedPicturesLine(line)){
					this.callbacks.onExpectedPictureCountKnown(line.willGenerateCount)
				} else if(isUpdatedPromptLine(line)){
					this.callbacks.onPromptUpdated(line.updatedPrompt)
				} else {
					console.error("Unknown action in line " + lineStr + ". Skipping it.")
				}
			} catch(e){
				log("Error processing generator stdout output: " + e)
			}
		})
	}

	private makeCommand(task: ServerGenerationTaskInputData): {bin: string, params: readonly string[], inputJson: string} {
		const json = JSON.stringify({
			prompt: task.prompt,
			...task.params
		})

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