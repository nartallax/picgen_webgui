import {MaybeRBoxed} from "client/base/box"

/** Control is a part of DOM tree that may have some additional control properties */
export interface Control {
	readonly el: HTMLElement
}

export function isControl(x: unknown): x is Control {
	return !!x && typeof(x) === "object" && (x as Control).el instanceof HTMLElement
}

// two types to take advantage of distribution of unions in conditional types
export type ControlOptions<T, Excluded extends keyof T = never> = T extends unknown ? _ControlOptions<T, Excluded> : never
type _ControlOptions<T, Excluded extends keyof T = never> = {
	readonly [k in keyof T]: k extends Excluded ? never : MaybeRBoxed<T[k]>
}