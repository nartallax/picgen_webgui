export function normalizeForFts(text: string): string {
	return text.toLowerCase().replace(/[^a-z\d]/g, " ").replace(/\s{2,}/g, " ").trim()
}