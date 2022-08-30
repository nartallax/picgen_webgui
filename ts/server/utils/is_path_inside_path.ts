import * as Path from "path"

export function isPathInsidePath(child: string, parent: string): boolean {
	child = Path.resolve(child)
	parent = Path.resolve(parent)
	const rel = Path.relative(parent, child)
	return !!rel && !Path.isAbsolute(rel) && !rel.match(/^\.\.[\\/]/)
}