import {PictureMask, Point2D, Polygon} from "common/entities/picture"
import {base64ToByteArray, bytesToBase64} from "common/utils/base64"

const floatResolution = 0xffff

class Encoder {
	private buffer: Uint8Array
	private index = 0

	constructor(private mask: PictureMask) {
		const maxLength = mask
			.map(polygon => polygon.length * 10) // in theory, each number can take up to 5 bytes
			.reduce((a, b) => a + b + 5, 0) + 10
		this.buffer = new Uint8Array(maxLength)
	}

	private writeMask(mask: PictureMask): void {
		this.writeInt(mask.length)
		for(const poly of mask){
			this.writePolygon(poly)
		}
	}

	private writePolygon(polygon: Polygon): void {
		this.writeInt(polygon.length)
		for(let i = 0; i < polygon.length; i++){
			this.writePoint(polygon[i]!, polygon[i - 1])
		}
	}

	private writePoint(point: Point2D, prevPoint: Point2D | undefined): void {
		if(!prevPoint){
			this.writeFloat(point.x)
			this.writeFloat(point.y)
		} else {
			this.writeFloat(point.x - prevPoint.x)
			this.writeFloat(point.y - prevPoint.y)
		}
	}

	private writeFloat(float: number): void {
		this.writeInt(Math.round(float * floatResolution))
	}

	private writeInt(int: number): void {
		const neg = int < 0
		let firstByte = 0
		if(neg){
			int = -int
			firstByte = 0x80
		}
		if(int > 0x3f){
			firstByte |= 0x40
		}
		firstByte |= int & 0x3f
		int = Math.floor(int / 64) // >> 6 without shenanigans about sign
		this.buffer[this.index++] = firstByte

		while(int !== 0){
			let byte = 0
			if(int > 0x7f){
				byte = 0x80
			}
			byte |= int & 0x7f
			int = Math.floor(int / 128) // >> 7 without shenanigans about sign
			this.buffer[this.index++] = byte
		}
	}

	encode(): string {
		if(this.index === 0){
			this.writeInt(0x01) // magic number
			this.writeMask(this.mask)
			this.buffer = this.buffer.slice(0, this.index - 1)
		}
		return bytesToBase64(this.buffer)
	}
}

class Decoder {
	private index = 0
	private result: PictureMask | null = null
	private readonly buffer: Uint8Array
	constructor(b64: string) {
		this.buffer = base64ToByteArray(b64)
	}

	decode(): PictureMask {
		if(!this.result){
			if(this.buffer.length === 0){
				// empty line is empty mask, simple as that
				this.result = []
			} else if(this.index !== 0){
				throw new Error("Magic number does not match; data is borken uwu")
			} else if(this.readInt() !== 0x01){
				// cannot merge it with check above because need to always readint (to check/skip magic number) on first decode()
				throw new Error("Magic number does not match; data is borken uwu")
			} else {
				this.result = this.readMask()
			}
		}
		return this.result
	}

	private readMask(): PictureMask {
		const len = this.readInt()
		const result: PictureMask = new Array(len)
		for(let i = 0; i < len; i++){
			result[i] = this.readPolygon()
		}
		return result
	}

	private readPolygon(): Polygon {
		const len = this.readInt()
		const result: Polygon = new Array(len)
		let point: Point2D | undefined = undefined
		for(let i = 0; i < len; i++){
			point = this.readPoint(point)
			result[i] = point
		}

		return result
	}

	private readPoint(prevPoint: Point2D | undefined): Point2D {
		let x = this.readFloat(), y = this.readFloat()
		if(prevPoint){
			x += prevPoint.x
			y += prevPoint.y
		}
		return {x, y}
	}

	private readFloat(): number {
		return this.readInt() / floatResolution
	}

	private readInt(): number {
		const firstByte = this.buffer[this.index++]!
		const neg = !!(firstByte & 0x80)
		let haveNext = !!(firstByte & 0x40)
		let int = firstByte & 0x3f
		let mult = 64

		while(haveNext){
			const byte = this.buffer[this.index++]!
			haveNext = !!(byte & 0x80)
			int += (byte & 0x7f) * mult
			mult *= 128
		}

		return neg ? -int : int
	}
}

export function encodePictureMask(mask: PictureMask): string {
	return new Encoder(mask).encode()
}

export function decodePictureMask(bytes: string): PictureMask {
	return new Decoder(bytes).decode()
}