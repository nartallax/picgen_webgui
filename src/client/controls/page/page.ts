import {ClientApi} from "client/app/client_api"
import {box, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {ParamsBlock} from "client/controls/params_block/params_block"
import {TagSearchBlock} from "client/controls/tag_search_block/tag_search_block"
import {GenParameterDefinition} from "common/common_types"

function updateParamValues(paramValues: {[key: string]: WBox<GenParameterDefinition["default"]>}, defs: readonly GenParameterDefinition[]) {
	const defMap = new Map(defs.map(x => [x.jsonName, x]))
	for(const name in paramValues){
		const value = paramValues[name]!
		const def = defMap.get(name)
		if(!def || typeof(value()) !== typeof(def.default)){
			delete paramValues[name]
			continue
		}
	}

	for(const def of defs){
		const oldValue = paramValues[def.jsonName]
		if(oldValue){
			continue
		}
		paramValues[def.jsonName] = box(def.default)
	}
}

export function Page(): HTMLElement {

	const paramValues = {} as {[key: string]: WBox< GenParameterDefinition["default"]>}
	const paramDefsBox = box(null as null | readonly GenParameterDefinition[])

	const contentTagBox = box(null as null | {readonly [tagContent: string]: readonly string[]})
	const selectedContentTags = box([] as string[]);

	(async() => {
		const [paramDefs, contentTags] = await Promise.all([
			ClientApi.getGenerationParameterDefinitions(),
			ClientApi.getContentTags()
		])

		updateParamValues(paramValues, paramDefs)
		paramDefsBox(paramDefs)

		contentTagBox(contentTags)
	})()


	return tag({class: "page-root"}, [
		tag({class: "settings-column"}, [
			ParamsBlock({paramDefs: paramDefsBox, paramValues}),
			TagSearchBlock({
				selectedContentTags,
				contentTags: contentTagBox,
				visibleTagLimit: 10
			})
		]),
		tag({class: "generation-column"})
	])
}