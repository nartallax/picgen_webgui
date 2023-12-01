const noop = () => {
	// nothing!
}

/** A class that is able to only show images that are actually on screen, and hide them when they are not
 * Doing so allows browser to unload pictures offscreen, which can help conserve memory
 * Expects data-src attribute to be assigned to actual image src */
export class ImageVisibilityController {
	// this weird scheme with three observers is required for two use-cases, which may appear simultaneously
	// first use-case is when class user is able to call doDeferredWork(), second when he isn't

	// almost-in-frame observer
	// intersecting images must be loaded
	private nearObserver: IntersectionObserver | null = null
	// somewhere-around observer
	// intersecting images should be loaded soon, non-intersecting images should be unloaded soon
	private farObserver: IntersectionObserver | null = null
	// far-away observer
	// non-intersecting images must be unloaded
	private veryFarObserver: IntersectionObserver | null = null
	private readonly knownImages = new Map<HTMLImageElement, (isVisible: boolean) => void>()
	private readonly deferredLoadableImages = new Set<HTMLImageElement>()
	// this is not a brain fart, we really need to defer unloading of images
	// because, as it turns out, unloading of a large image can cause a lag for up to 150ms
	// which is very noticeable
	// (or was I mistaken and it was something else...?)
	private readonly deferredUnloadableImages = new Set<HTMLImageElement>()

	doDeferredWork(): void {
		for(const img of this.deferredLoadableImages){
			this.load(img)
		}
		for(const img of this.deferredUnloadableImages){
			this.unload(img)
		}
	}

	private load(img: HTMLImageElement): void {
		this.deferredLoadableImages.delete(img)
		this.deferredUnloadableImages.delete(img)
		if(img.getAttribute("src")){
			return
		}
		// console.log("loading " + img.dataset["src"])
		img.setAttribute("src", img.dataset["src"] ?? "")
		const handler = this.knownImages.get(img) ?? noop
		handler(true)
	}

	private unload(img: HTMLImageElement): void {
		this.deferredLoadableImages.delete(img)
		this.deferredUnloadableImages.delete(img)
		if(!img.getAttribute("src")){
			return
		}
		// console.log("unloading " + img.dataset["src"])
		img.removeAttribute("src")
		const handler = this.knownImages.get(img) ?? noop
		handler(false)
	}

	addImage(img: HTMLImageElement, handler?: (isVisible: boolean) => void): void {
		this.nearObserver?.observe(img)
		this.farObserver?.observe(img)
		this.knownImages.set(img, handler ?? noop)
	}

	start(): void {
		this.nearObserver = this.makeObserver(250, (isIntersecting, img) => {
			if(isIntersecting){
				this.load(img)
			}
		})

		this.farObserver = this.makeObserver(window.innerWidth, (isIntersecting, img) => {
			if(isIntersecting){
				this.deferredLoadableImages.add(img)
			} else if(img.getAttribute("src")){
				this.deferredUnloadableImages.add(img)
			}
		})

		this.veryFarObserver = this.makeObserver(window.innerWidth * 2, (isIntersecting, img) => {
			if(img.getAttribute("src") && !isIntersecting){
				this.unload(img)
			}
		})

		for(const img of this.knownImages.keys()){
			this.nearObserver.observe(img)
			this.farObserver.observe(img)
			this.veryFarObserver.observe(img)
		}
	}

	private makeObserver(margin: number, doWith: (isIntersecting: boolean, image: HTMLImageElement) => void): IntersectionObserver {
		return new IntersectionObserver(entries => {
			for(const entry of entries){
				const img = entry.target
				if(!(img instanceof HTMLImageElement)){
					continue
				}

				doWith(entry.isIntersecting, img)
			}
		}, {rootMargin: margin + "px"})
	}

	stop(): void {
		this.nearObserver?.disconnect()
		this.nearObserver = null
		this.farObserver?.disconnect()
		this.farObserver = null
		this.veryFarObserver?.disconnect()
		this.veryFarObserver = null
	}


}