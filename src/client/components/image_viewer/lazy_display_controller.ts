import {RBox} from "@nartallax/cardboard"
import {bindBox} from "@nartallax/cardboard-dom"

export class LazyDisplayController {
	private readonly observer: IntersectionObserver
	private readonly knownImages = new Set<HTMLImageElement>()

	constructor(root: HTMLElement, imgs: RBox<HTMLImageElement[]>) {
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

		bindBox(root, imgs, imgs => {
			const newImgSet = new Set(imgs)

			for(const oldImg of this.knownImages){
				if(!newImgSet.has(oldImg)){
					this.observer.unobserve(oldImg)
					this.knownImages.delete(oldImg)
				}
			}

			for(const newImg of newImgSet){
				if(!this.knownImages.has(newImg)){
					this.observer.observe(newImg)
					this.knownImages.add(newImg)
				}
			}
		})
	}

	destroy(): void {
		this.observer.disconnect()
	}


}