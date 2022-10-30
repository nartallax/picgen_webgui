export function readFileToArrayBuffer(file: File): Promise<ArrayBuffer> {
	return new Promise((ok, bad) => {
		const fr = new FileReader()
		fr.addEventListener("load", () => {
			const result = fr.result
			if(!(result instanceof ArrayBuffer)){
				bad(new Error("FileReader red file " + file.name + " not as ArrayBuffer"))
				return
			}
			ok(result)
		})
		fr.addEventListener("error", err => {
			bad(new Error("Failed to load file " + file.name + ": " + err))
		})
		fr.readAsArrayBuffer(file)
	})
}