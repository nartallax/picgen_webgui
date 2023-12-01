import {RBox} from "@nartallax/cardboard"
import {bindBox} from "@nartallax/cardboard-dom"

/** A class that is able to only show images that are actually on screen, and hide them when they are not
 * Doing so allows browser to unload pictures offscreen, which can help conserve memory
 * Expects data-src attribute to be assigned to actual image src */
export class ImageVisibilityController {
	private readonly observer: IntersectionObserver
	private readonly knownImages = new Set<HTMLImageElement>()

	constructor() {
		this.observer = new IntersectionObserver(entries => {
			for(const entry of entries){
				const img = entry.target
				if(!(img instanceof HTMLImageElement)){
					continue
				}

				if(!entry.isIntersecting){
					if(img.getAttribute("src")){
						// console.log("unloading " + img.dataset["src"])
						img.removeAttribute("src")
					}
				} else {
					// console.log("loading " + img.dataset["src"])
					img.setAttribute("src", img.dataset["src"] ?? "")
				}
			}
		}, {rootMargin: "250px"})
	}

	addImage(img: HTMLImageElement): void {
		this.observer.observe(img)
		this.knownImages.add(img)
	}

	removeImage(img: HTMLImageElement): void {
		this.observer.unobserve(img)
		this.knownImages.delete(img)
	}

	addImageArrayBox(root: HTMLElement, imgs: RBox<HTMLImageElement[]>): void {
		bindBox(root, imgs, imgs => {
			const newImgSet = new Set(imgs)

			for(const oldImg of this.knownImages){
				if(!newImgSet.has(oldImg)){
					this.removeImage(oldImg)
				}
			}

			for(const newImg of newImgSet){
				if(!this.knownImages.has(newImg)){
					this.addImage(newImg)
				}
			}
		})
	}

	destroy(): void {
		this.observer.disconnect()
	}


}