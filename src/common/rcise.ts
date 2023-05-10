import {RC} from "@nartallax/ribcage"

export type RCise<T> =
	T extends number ? RC.Number :
		T extends string ? RC.String :
			T extends boolean ? RC.Bool :
				T extends null ? RC.Constant<null> :
					T extends undefined ? RC.Constant<undefined> :
						T extends (infer V)[] ? RCise<V>[] :
							T extends readonly (infer V)[] ? readonly RCise<V>[] :
								T extends Record<string, unknown> ? RC.Struct<{[k in keyof T]: RCise<T[k]>}> :
									RC.Any