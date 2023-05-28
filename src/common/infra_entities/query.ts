import {RC} from "@nartallax/ribcage"
import {RCise} from "common/utils/rcise"

export type FilterField<T extends Record<string, unknown>> = RC.Value<ReturnType<typeof FilterField<RC.FieldsOf<RCise<T>>>>>
export const FilterField = <F extends RC.StructFields>(itemType: RC.Struct<F>) => RC.struct({
	field: RC.keyOf(itemType)
})

export type FilterConstantValue = RC.Value<typeof FilterConstantValue>
const FilterPrimitive = RC.union([RC.string(), RC.number(), RC.bool()])
export const FilterConstantValue = RC.struct({
	value: RC.union([FilterPrimitive, RC.array(FilterPrimitive)])
})

export type FilterValue<T extends Record<string, unknown>> = RC.Value<ReturnType<typeof FilterValue<RC.FieldsOf<RCise<T>>>>>
export const FilterValue = <F extends RC.StructFields>(itemType: RC.Struct<F>) => RC.union([
	FilterConstantValue,
	FilterField(itemType)
])


const filterOpsArray = [">", ">=", "<", "<=", "=", "in"] as const

type FilterOp = RC.Value<typeof FilterOp>
const FilterOp = RC.union(filterOpsArray.map(x => RC.constant(x)))
export const allowedFilterOps = new Set(filterOpsArray) as ReadonlySet<FilterOp>

export type BinaryQueryCondition<T extends Record<string, unknown>> = RC.Value<ReturnType<typeof BinaryQueryCondition<RC.FieldsOf<RCise<T>>>>>
export const BinaryQueryCondition = <F extends RC.StructFields>(itemType: RC.Struct<F>) => RC.struct({
	a: FilterValue(itemType),
	b: FilterValue(itemType),
	op: FilterOp
})

export type SimpleListQueryParams<T extends Record<string, unknown>> = RC.Value<ReturnType<typeof SimpleListQueryParams<RC.FieldsOf<RCise<T>>>>>
export const SimpleListQueryParams = <F extends RC.StructFields>(itemType: RC.Struct<F>) => RC.struct(RC.structFields({opt: {
	sortBy: RC.keyOf(itemType),
	filters: RC.array(BinaryQueryCondition(itemType)),
	desc: RC.bool(),
	offset: RC.number(),
	limit: RC.number()
}}))