import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {Picture} from "common/entities/picture"

export interface ThumbnailProvidingContext {
	getThumbnail(picture: Picture | string): HTMLImageElement
	waitNextBatchLoad(): Promise<void>
}

export class ThumbnailProvider {

	private urlCache: Map<number | string, string> = new Map()

	get cacheSize(): number {
		return this.urlCache.size
	}

	splitThumbPackIntoImages(encodedBytes: ArrayBuffer, count: number): ArrayBuffer[] {
		const byteArr = new Uint8Array(encodedBytes)

		const lengths: number[] = new Array(count)
		let offset = 0
		for(let i = 0; i < count; i++){
			const len = (byteArr[offset + 0]! << 0)
					| (byteArr[offset + 1]! << 8)!
					| (byteArr[offset + 2]! << 16)
					| (byteArr[offset + 3]! << 24)
			lengths[i] = len
			offset += 4
		}

		const result: ArrayBuffer[] = []

		for(let i = 0; i < lengths.length; i++){
			const imgByteLength = lengths[i]!
			const imgBytes = encodedBytes.slice(offset, offset + imgByteLength)
			offset += imgByteLength
			result.push(imgBytes)
		}

		return result
	}

	private getPictureId(picture: Picture | string): string | number {
		return typeof(picture) === "string" ? picture : picture.id
	}

	async loadUserStaticThumbnails(names: readonly string[]): Promise<void> {
		const packBytes = await ClientApi.getUserStaticThumbnails()
		this.loadPack(packBytes, names)
	}

	private loadPack(packBytes: ArrayBuffer, pictures: readonly (Picture | string)[]): void {
		const parts = this.splitThumbPackIntoImages(packBytes, pictures.length)

		for(let i = 0; i < pictures.length; i++){
			const imgBytes = parts[i]!
			const picture = pictures[i]!

			if(this.urlCache.has(this.getPictureId(picture))){
				// for rare cases of concurrent requests for same picture
				// can't imagine how this could happen
				// but should take this into account anyway
				continue
			}

			const blob = new Blob([imgBytes])
			// we'll probably never revoke them
			// oh well. it shouldn't be too much of a problem, thumbs are small
			const url = URL.createObjectURL(blob)
			this.urlCache.set(this.getPictureId(picture), url)
		}
	}

	private async loadThumbnails(pictures: (Picture | string)[]): Promise<void> {
		const unknownPictures = pictures.filter(pic => !this.urlCache.has(this.getPictureId(pic)))

		if(unknownPictures.length > 0){
			const hasString = pictures.find(x => typeof(x) === "string")
			if(hasString){
				throw new Error("User context thumbnails are not loadable one-by-one")
			}

			const packBytes = await ClientApi.getPictureThumbnails(unknownPictures as Picture[])
			this.loadPack(packBytes, unknownPictures)
		}
	}

	makeContext(options: {debounceTimeMs?: number, useDataAttribute?: boolean} = {}): ThumbnailProvidingContext {
		const debounceTimeMs = options.debounceTimeMs ?? 25
		let pics: {img: HTMLImageElement, picture: Picture | string}[] = []
		let timer: ReturnType<typeof setTimeout> | null = null
		let loadWaiters: (() => void)[] = []

		const sendIt = async() => {
			timer = null
			const oldPics = pics
			pics = []

			await this.loadThumbnails(oldPics.map(x => x.picture))
			for(const {img, picture} of oldPics){
				const id = this.getPictureId(picture)
				const src = this.urlCache.get(id)!
				if(options.useDataAttribute){
					img.dataset["src"] = src
				} else {
					img.setAttribute("src", src)
				}
				img.style.visibility = ""
			}

			const oldLoadWaiters = loadWaiters
			loadWaiters = []
			for(const waiter of oldLoadWaiters){
				waiter()
			}
		}


		return {
			getThumbnail: picture => {
				const img = tag({tag: "img", attrs: {alt: "thumbnail"}, style: {visibility: "hidden"}})
				img.loading = "eager"
				pics.push({picture, img: img})
				if(timer === null){
					timer = setTimeout(() => void sendIt(), debounceTimeMs)
				}
				return img
			},
			waitNextBatchLoad: () => new Promise<void>(ok => {
				if(timer === null){
					ok()
				} else {
					loadWaiters.push(ok)
				}
			})
		}
	}

}