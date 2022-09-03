interface PrefixTreeNode<T> {
	values?: T[]
	leaves?: {[k: string]: PrefixTreeNode<T>}
}

export class PrefixTree<T> {

	private readonly root: PrefixTreeNode<T>
	private readonly rootsByLetters: Map<string, PrefixTreeNode<T>[]>

	constructor(sourceValuesWithKeys: [T, readonly string[]][]) {
		this.root = this.buildTree(sourceValuesWithKeys)
		this.rootsByLetters = this.extractRootsByLetters()
	}

	private extractRootsByLetters(): Map<string, PrefixTreeNode<T>[]> {
		const result = new Map<string, PrefixTreeNode<T>[]>()
		this.addNodeToRootMap(this.root, result)
		return result
	}

	private addNodeToRootMap(node: PrefixTreeNode<T>, map: Map<string, PrefixTreeNode<T>[]>): void {
		if(!node.leaves){
			return
		}
		for(const char in node.leaves){
			const child = node.leaves[char]!
			let arr = map.get(char)
			if(!arr){
				arr = []
				map.set(char, arr)
			}

			arr.push(child)
			this.addNodeToRootMap(child, map)
		}
	}

	private buildTree(sourceValuesWithKeys: [T, readonly string[]][]): PrefixTreeNode<T> {
		const result: PrefixTreeNode<T> = {}
		for(const [value, keys] of sourceValuesWithKeys){
			for(const key of keys){
				this.addToTree(result, key, value)
			}
		}
		return result
	}

	private addToTree(node: PrefixTreeNode<T>, key: string, value: T): void {
		for(const char of key){
			const leaves = node.leaves ||= {}
			node = leaves[char] ||= {}
		}
		(node.values ||= []).push(value)
	}

	getAllValuesWhichKeysInclude(substr: string, forbiddenValues: ReadonlySet<T> = new Set(), maxValues: number = Number.MAX_SAFE_INTEGER): Set<T> {
		const result = new Set(this.root.values || [])
		const roots = this.rootsByLetters.get(substr[0] || "--")
		if(roots){
			for(const root of roots){
				let node: PrefixTreeNode<T> | undefined = root
				for(let i = 0; i < substr.length; i++){
					node = node!.leaves?.[substr[i]!]
					if(!node){
						break
					}
				}

				if(node){
					const hitCutoff = this.collectAllValuesIntoSet(node, forbiddenValues, maxValues, result)
					if(hitCutoff){
						break
					}
				}
			}
		}
		return result
	}

	private collectAllValuesIntoSet(node: PrefixTreeNode<T>, forbiddenValues: ReadonlySet<T>, maxValues: number, set: Set<T>): boolean {
		const stack = [node]
		while(true){
			const node = stack.pop()
			if(!node){
				return false
			}
			if(node.values){
				for(let i = 0; i < node.values.length; i++){
					const v = node.values[i]!
					if(forbiddenValues.has(v)){
						continue
					}
					set.add(v)
					if(set.size > maxValues){
						return true
					}
				}
			}
			if(node.leaves){
				for(const char in node.leaves){
					stack.push(node.leaves[char]!)
				}
			}
		}
	}

}
