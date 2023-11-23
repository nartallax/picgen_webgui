import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {Picture} from "common/entities/picture"

export interface ThumbnailProvidingContext {
	getThumbnail(picture: Picture | string): Promise<HTMLImageElement>
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

	private makeImageFromUrl(url: string): HTMLImageElement {
		return tag({tag: "img", attrs: {
			src: url,
			alt: "thumbnail"
		}})
	}

	async loadUserStaticThumbnails(): Promise<void> {
		const [packBytes, names] = await Promise.all([
			ClientApi.getUserStaticThumbnails(),
			ClientApi.getUserStaticNames()
		])
		this.loadPack(packBytes, names)
	}

	getThumbnailNow(picture: Picture | string): HTMLImageElement | null {
		const url = this.urlCache.get(this.getPictureId(picture))
		if(!url){
			return null
		} else {
			return this.makeImageFromUrl(url)
		}
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

	async getThumbnails(pictures: (Picture | string)[]): Promise<HTMLImageElement[]> {
		const unknownPictures = pictures.filter(pic => !this.urlCache.has(this.getPictureId(pic)))

		if(unknownPictures.length > 0){
			const hasString = pictures.find(x => typeof(x) === "string")
			if(hasString){
				throw new Error("User context thumbnails are not loadable one-by-one")
			}

			const packBytes = await ClientApi.getPictureThumbnails(unknownPictures as Picture[])
			this.loadPack(packBytes, unknownPictures)
		}

		const imgs: HTMLImageElement[] = pictures.map(picture =>
			this.makeImageFromUrl(this.urlCache.get(this.getPictureId(picture))!)
		)

		return imgs
	}

	makeContext(debounceTimeMs = 25): ThumbnailProvidingContext {
		let picturesAndPromises: {picture: Picture | string, ok: (img: HTMLImageElement) => void, err: (err: Error) => void}[] = []
		let timer: ReturnType<typeof setTimeout> | null = null

		const sendIt = async() => {
			timer = null
			const inputData = picturesAndPromises
			picturesAndPromises = []
			try {
				const thumbs = await this.getThumbnails(inputData.map(x => x.picture))
				for(let i = 0; i < inputData.length; i++){
					inputData[i]!.ok(thumbs[i]!)
				}
			} catch(e){
				if(!(e instanceof Error)){
					throw e
				}
				for(const {err} of inputData){
					err(e)
				}
			}
		}


		return {
			getThumbnail: picture => new Promise<HTMLImageElement>((ok, err) => {
				picturesAndPromises.push({picture, ok, err})
				if(timer === null){
					timer = setTimeout(() => void sendIt(), debounceTimeMs)
				}
			})
		}
	}

}