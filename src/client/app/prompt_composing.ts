type PromptParts = {
	shape: string | null
	body: string
}

export function composePrompt(parts: PromptParts): string {
	return [(parts.shape ?? ""), parts.body].filter(x => !!x).join(" ").replace(/ ,/g, ",")
}

export function decomposePrompt(prompt: string, allKnownShapeTags: readonly string[]): PromptParts {
	let shapeTag: string | null = null
	for(const tag of allKnownShapeTags ?? []){
		if(prompt.startsWith(tag) && (shapeTag?.length ?? 0) < tag.length){
			shapeTag = tag
		}
	}

	if(shapeTag){
		prompt = prompt.substring(shapeTag.length).trim()
	}

	return {shape: shapeTag, body: prompt}
}