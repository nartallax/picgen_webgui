import {ClientApi} from "client/app/client_api"
import {box} from "client/base/box"
import {tag} from "client/base/tag"
import {ParamDefWithValue} from "client/client_types"
import {ParamsBlock} from "client/controls/params_block/params_block"

export function Page(): HTMLElement {

	const paramDefsBox = box(null as null | ParamDefWithValue[]);

	(async() => {
		const paramDefs = await ClientApi.getGenerationParameterDefinitions()
		paramDefsBox(paramDefs.map(def => ({
			...def,
			value: box(def.default)
		} as ParamDefWithValue)))
	})()


	return tag({class: "page-root"}, [
		tag({class: "settings-column"}, [
			ParamsBlock({paramDefs: paramDefsBox})
		]),
		tag({class: "generation-column"})
	])
}