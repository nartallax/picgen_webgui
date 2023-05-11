type PromptParts = {
	shape: string | null
	body: string
	content: readonly string[]
}

export function composePrompt(parts: PromptParts): string {
	return [(parts.shape ?? ""), parts.body, parts.content.map(x => ", " + x).join("")].filter(x => !!x).join(" ").replace(/ ,/g, ",")
}

export function decomposePrompt(prompt: string, allKnownShapeTags: readonly string[], allKnownContentTags: readonly string[]): PromptParts {
	let shapeTag: string | null = null
	for(const tag of allKnownShapeTags ?? []){
		if(prompt.startsWith(tag) && (shapeTag?.length ?? 0) < tag.length){
			shapeTag = tag
		}
	}

	if(shapeTag){
		prompt = prompt.substring(shapeTag.length).trim()
	}

	const content = []
	const contentSet = new Set(allKnownContentTags)
	const commaSeparated = prompt.split(",").map(x => x.trim())
	while(true){
		const tail = commaSeparated.pop()
		if(tail && contentSet.has(tail)){
			content.push(tail)
			prompt = prompt.substring(0, prompt.length - tail.length).replace(/[ ,]+$/, "")
		} else {
			break
		}
	}

	return {shape: shapeTag, body: prompt, content}
}