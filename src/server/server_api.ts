import {GenParameterDefinition} from "common/common_types"
import {cont} from "server/async_context"
import {config} from "server/config"
import {log} from "server/log"

export namespace ServerApi {

	export function getGenerationParameterDefinitions(): readonly GenParameterDefinition[] {
		return config.generationParameters
	}

	export function getShapeTags(): readonly string[] {
		return config.tags.shape
	}

	export function getContentTags(): {readonly [tagContent: string]: readonly string[]} {
		return config.tags.content
	}

	export async function sleepAndLog(): Promise<string> {
		log(cont().testValue)
		await new Promise(ok => setTimeout(ok, 1000))
		log(cont().testValue)
		await new Promise(ok => setTimeout(ok, 1000))
		log(cont().testValue)
		return cont().testValue
	}

}