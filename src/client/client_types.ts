import {WBox} from "client/base/box"
import {BoolGenParamDefinition, FloatGenParamDefinition, IntGenParamDefinition} from "common/common_types"

export type ParamDefWithValue = BoolParamLineOptions | NumberParamLineOptions

type BoolParamLineOptions = BoolGenParamDefinition & {
	readonly value: WBox<boolean>
}

type NumberParamLineOptions = (FloatGenParamDefinition | IntGenParamDefinition) & {
	readonly value: WBox<number>
}