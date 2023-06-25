import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {Picture} from "common/entities/picture"

export interface ThumbnailProvidingContext {
	getThumbnail(picture: Picture): Promise<HTMLImageElement>
}

export class ThumbnailProvider {

	private urlCache: Map<number, string> = new Map()

	async getThumbnails(pictures: Picture[]): Promise<HTMLImageElement[]> {
		const unknownPictures = pictures.filter(pic => !this.urlCache.has(pic.id))

		const encodedBytes = await ClientApi.getPictureThumbnails(unknownPictures)
		const byteArr = new Uint8Array(encodedBytes)

		const lengths: number[] = new Array(unknownPictures.length)
		let offset = 0
		for(let i = 0; i < unknownPictures.length; i++){
			const len = (byteArr[offset + 0]! << 0)
					| (byteArr[offset + 1]! << 8)!
					| (byteArr[offset + 2]! << 16)
					| (byteArr[offset + 3]! << 24)
			lengths[i] = len
			offset += 4
		}


		for(let i = 0; i < lengths.length; i++){
			const imgByteLength = lengths[i]!
			const picture = unknownPictures[i]!
			const imgBytes = encodedBytes.slice(offset, offset + imgByteLength)
			offset += imgByteLength

			if(this.urlCache.has(picture.id)){
				// for rare cases of concurrent requests for same picture
				// can't imagine how this could happen
				// but should take this into account anyway
				continue
			}

			const blob = new Blob([imgBytes])
			// we'll probably never revoke them
			// oh well. it shouldn't be too much of a problem, thumbs are small
			const url = URL.createObjectURL(blob)
			this.urlCache.set(picture.id, url)
		}

		const imgs: HTMLImageElement[] = pictures.map(picture => tag({tag: "img", attrs: {
			src: this.urlCache.get(picture.id)!,
			alt: "thumbnail"
		}}))

		return imgs
	}

	makeContext(debounceTimeMs = 25): ThumbnailProvidingContext {
		let picturesAndPromises: {picture: Picture, ok: (img: HTMLImageElement) => void, err: (err: Error) => void}[] = []
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
					timer = setTimeout(sendIt, debounceTimeMs)
				}
			})
		}
	}

}