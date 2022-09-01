export function isEnoent(e: unknown): e is Error & {code: "ENOENT"} {
	return !!e && (e as (Error & {code: "ENOENT"})).code === "ENOENT"
}