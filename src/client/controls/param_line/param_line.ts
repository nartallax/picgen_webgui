import {RBox, viewBox, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {BoolInput} from "client/controls/bool_input/bool_input"
import {ImageMaskInputButton} from "client/controls/image_mask_input/image_mask_input"
import {NumberInput} from "client/controls/number_input/number_input"
import {PictureInput} from "client/controls/picture_input/picture_input"
import {TextInput} from "client/controls/text_input/text_input"
import {GenParameterDefinition} from "common/common_types"
import {GenerationTaskParameterValue} from "common/entity_types"

export function defaultValueOfParam(def: GenParameterDefinition): GenerationTaskParameterValue {
	switch(def.type){
		case "picture":
			return 0
		case "picture_mask":
			return ""
		default: return def.default
	}
}

export function ParamLine(def: GenParameterDefinition, value: WBox<GenerationTaskParameterValue>, allValues: {readonly [key: string]: WBox<GenerationTaskParameterValue>}): HTMLElement {
	let input: HTMLElement
	switch(def.type){
		case "int":
		case "float":
			input = NumberInput({
				value: value as WBox<number>,
				int: def.type === "int",
				max: def.max,
				min: def.min,
				step: def.type === "int" ? def.step : undefined
			})
			break
		case "bool":
			input = BoolInput({
				value: value as WBox<boolean>
			})
			break
		case "string":
			input = TextInput({
				value: value as WBox<string>,
				maxLength: def.maxLength,
				minLength: def.minLength
			})
			break
		case "picture":
			input = PictureInput({
				value: value as WBox<number>,
				param: def
			})
			break
		case "picture_mask":{
			const baseValue = allValues[def.basePictureParameter]
			if(!baseValue){
				throw new Error(`Parameter ${def.jsonName} (which is picture mask) expects to have a picture parameter named ${def.basePictureParameter}, but there isn't one.`)
			}
			if(typeof(baseValue()) !== "number"){
				throw new Error(`Parameter ${def.jsonName} (which is picture mask) expects to have a picture parameter named ${def.basePictureParameter}, but that's not a picture parameter.`)
			}
			input = ImageMaskInputButton({
				imageId: baseValue as RBox<number>,
				value: value as WBox<string>
			})
			break
		}
	}

	return tag({tagName: "tr", class: "param-line"}, [
		tag({
			tagName: "td",
			class: "param-line-label",
			text: def.uiName
		}),
		tag({
			tagName: "td",
			class: ["param-line-revert-button", "icon-ccw", {
				hidden: viewBox(() => value() === defaultValueOfParam(def))
			}],
			on: {
				click: () => value(defaultValueOfParam(def))
			}
		}),
		tag({
			tagName: "td",
			class: "param-line-input-wrap"
		}, [input])
	])
}