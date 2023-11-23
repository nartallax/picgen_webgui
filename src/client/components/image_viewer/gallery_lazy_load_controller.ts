export class LazyLoadController {
	constructor(readonly container: HTMLElement) {}

	private loadCount = 0
	private lastCenterIndex = 0

	update(centerIndex: number): void {
		console.log("update", this.loadCount)
		this.lastCenterIndex = centerIndex
		if(this.loadCount > 0){
			return
		}

		const images = this.container.querySelectorAll("img")
		const containerRect = this.container.getBoundingClientRect()

		this.walkIndex(images, centerIndex, -1, containerRect)
		this.walkIndex(images, centerIndex, 1, containerRect)
	}

	private readonly decLoadCount = () => {
		this.loadCount--
		if(this.loadCount === 0){
			this.update(this.lastCenterIndex)
		}
	}

	private walkIndex(images: ArrayLike<HTMLImageElement>, startIndex: number, increment: number, containerRect: DOMRect): void {
		let index = startIndex
		while(true){
			const img = images[index]
			index += increment
			if(!img){
				break
			}

			if(img.getAttribute("src")){
				const rect = img.getBoundingClientRect()
				if(Math.abs(index - startIndex) < 2){
					// never unload images that are close to the current
					// they are required for right/left scroll
					continue
				}
				if(!hasHIntersection(rect, containerRect)){
					console.log("unloading image " + img.getAttribute("data-src"))
					img.removeAttribute("src")
					if(img.getAttribute("data-loading") === "true"){
						this.decLoadCount()
						img.removeEventListener("load", this.decLoadCount)
						img.removeAttribute("data-loading")
					}
				}
			} else {
				const wrap = img.parentElement
				if(!wrap){
					continue
				}
				const rect = wrap.getBoundingClientRect()
				if(hasHIntersection(rect, containerRect)){
					console.log("loading image " + img.getAttribute("data-src"), rect, containerRect)
					img.setAttribute("data-loading", "true")
					this.loadCount++
					img.addEventListener("load", this.decLoadCount, {once: true, passive: true})
					img.setAttribute("src", img.getAttribute("data-src")!)
					break // this prevents loading of all the images at once when viewer is just opened
				}
			}
		}
	}
}

function hasHIntersection(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && a.right > b.left
}