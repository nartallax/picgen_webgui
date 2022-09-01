export interface NodeDataAttacher<T> {
	get(node: Node): T | undefined
	set(node: Node, value: T): void
	delete(node: Node): boolean
	has(node: Node): boolean
}

export function makeNodeDataAttacher<T>(key: string): NodeDataAttacher<T> {
	return typeof(WeakMap) === "undefined" ? new PropNodeDataAttacher(key) : new WeakMapNodeDataAttacher()
}

class WeakMapNodeDataAttacher<T> implements NodeDataAttacher<T> {

	private readonly map = new WeakMap<Node, T>()

	get(node: Node): T | undefined {
		return this.map.get(node)
	}

	set(node: Node, value: T): void {
		this.map.set(node, value)
	}

	delete(node: Node): boolean {
		return this.map.delete(node)
	}

	has(node: Node): boolean {
		return this.map.has(node)
	}

}

// fallback for when weakmap is not available
class PropNodeDataAttacher<T> implements NodeDataAttacher<T> {

	constructor(readonly key: string) {}

	get(node: Node): T | undefined {
		return (node as Node & Record<string, T>)[this.key]
	}

	set(node: Node, value: T): void {
		(node as Node & Record<string, T>)[this.key] = value
	}

	delete(node: Node): boolean {
		const hasValue = this.has(node)
		delete(node as Node & Record<string, T>)[this.key]
		return hasValue
	}

	has(node: Node): boolean {
		return this.key in node
	}

}