export function byteArrayToBase64(arr: Uint8Array): string {
	if(typeof(Buffer) !== "undefined"){
		if(arr instanceof Buffer){
			return arr.toString("base64")
		} else {
			return Buffer.from(arr).toString("base64")
		}
	} else {
		return bytesToBase64(arr)
	}
}

export function base64ToByteArray(b64: string): Uint8Array {
	if(typeof(Buffer) !== "undefined"){
		const buffer = Buffer.from(b64, "base64")
		return new Uint8Array(buffer, 0, buffer.length)
	} else {
		return base64ToBytes(b64)
	}
}

// source: https://gist.github.com/enepomnyaschih/54c437997f8202871278d0fdf68148ca
const base64abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("")

const l = 256, base64codes = new Uint8Array(l)
for(let i = 0; i < l; ++i){
	base64codes[i] = 255 // invalid character
}
base64abc.forEach((char, index) => {
	base64codes[char.charCodeAt(0)] = index
})
base64codes["=".charCodeAt(0)] = 0 // ignored anyway, so we just need to prevent an error

function getBase64Code(charCode: number): number {
	if(charCode >= base64codes.length){
		throw new Error("Unable to parse base64 string.")
	}
	const code = base64codes[charCode]!
	if(code === 255){
		throw new Error("Unable to parse base64 string.")
	}
	return code
}

export function bytesToBase64(bytes: ArrayLike<number>): string {
	let result = "", i
	const l = bytes.length
	for(i = 2; i < l; i += 3){
		result += base64abc[bytes[i - 2]! >> 2]
		result += base64abc[((bytes[i - 2]! & 0x03) << 4) | (bytes[i - 1]! >> 4)]
		result += base64abc[((bytes[i - 1]! & 0x0F) << 2) | (bytes[i]! >> 6)]
		result += base64abc[bytes[i]! & 0x3F]
	}
	if(i === l + 1){ // 1 octet yet to write
		result += base64abc[bytes[i - 2]! >> 2]
		result += base64abc[(bytes[i - 2]! & 0x03) << 4]
		result += "=="
	}
	if(i === l){ // 2 octets yet to write
		result += base64abc[bytes[i - 2]! >> 2]
		result += base64abc[((bytes[i - 2]! & 0x03) << 4) | (bytes[i - 1]! >> 4)]
		result += base64abc[(bytes[i - 1]! & 0x0F) << 2]
		result += "="
	}
	return result
}

export function base64ToBytes(str: string): Uint8Array {
	if(str.length % 4 !== 0){
		throw new Error("Unable to parse base64 string.")
	}
	const index = str.indexOf("=")
	if(index !== -1 && index < str.length - 2){
		throw new Error("Unable to parse base64 string.")
	}
	const missingOctets = str.endsWith("==") ? 2 : str.endsWith("=") ? 1 : 0,
		n = str.length,
		result = new Uint8Array(3 * (n / 4))
	let buffer: number
	for(let i = 0, j = 0; i < n; i += 4, j += 3){
		buffer
			= getBase64Code(str.charCodeAt(i)) << 18
			| getBase64Code(str.charCodeAt(i + 1)) << 12
			| getBase64Code(str.charCodeAt(i + 2)) << 6
			| getBase64Code(str.charCodeAt(i + 3))
		result[j] = buffer >> 16
		result[j + 1] = (buffer >> 8) & 0xFF
		result[j + 2] = buffer & 0xFF
	}
	return result.subarray(0, result.length - missingOctets)
}