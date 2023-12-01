const noop = () => {
	// nothing!
}

/** A class that is able to only show images that are actually on screen, and hide them when they are not
 * Doing so allows browser to unload pictures offscreen, which can help conserve memory
 * Expects data-src attribute to be assigned to actual image src */
export class ImageVisibilityController {
	private observer: IntersectionObserver | null = null
	private readonly knownImages = new Map<HTMLImageElement, (isVisible: boolean) => void>()

	addImage(img: HTMLImageElement, handler?: (isVisible: boolean) => void): void {
		this.observer?.observe(img)
		this.knownImages.set(img, handler ?? noop)
	}

	// removeImage(img: HTMLImageElement): void {
	// 	this.observer?.unobserve(img)
	// 	this.knownImages.delete(img)
	// }

	// addImageArrayBox(root: HTMLElement, imgs: RBox<HTMLImageElement[]>): void {
	// 	bindBox(root, imgs, imgs => {
	// 		const newImgSet = new Set(imgs)

	// 		for(const oldImg of this.knownImages){
	// 			if(!newImgSet.has(oldImg)){
	// 				this.removeImage(oldImg)
	// 			}
	// 		}

	// 		for(const newImg of newImgSet){
	// 			if(!this.knownImages.has(newImg)){
	// 				this.addImage(newImg)
	// 			}
	// 		}
	// 	})
	// }

	start(): void {
		this.observer = this.observer = new IntersectionObserver(entries => {
			for(const entry of entries){
				const img = entry.target
				if(!(img instanceof HTMLImageElement)){
					continue
				}

				const handler = this.knownImages.get(img) ?? noop

				if(!entry.isIntersecting){
					if(img.getAttribute("src")){
						// console.log("unloading " + img.dataset["src"])
						img.removeAttribute("src")
					}
				} else {
					// console.log("loading " + img.dataset["src"])
					img.setAttribute("src", img.dataset["src"] ?? "")
				}
				handler(entry.isIntersecting)
			}
		}, {rootMargin: "250px"})

		for(const img of this.knownImages.keys()){
			this.observer.observe(img)
		}
	}

	stop(): void {
		this.observer?.disconnect()
		this.observer = null
	}


}