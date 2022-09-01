import {GenParameterDefinition} from "common/common_types"
import {config} from "server/config"

export namespace ServerApi {

	export function getGenerationParameterDefinitions(): readonly GenParameterDefinition[] {
		return config.generationParameters
	}

	export function getFormTags(): readonly string[] {
		return config.tags.form
	}

	export function getContentTags(): {readonly [tagContent: string]: readonly string[]} {
		return config.tags.content
	}

}