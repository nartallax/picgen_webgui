import * as Stream from "stream"

export function bufferToReadableStream(buffer: Buffer): Stream.Readable {
	const stream = new Stream.Duplex()
	stream.push(buffer)
	stream.push(null)
	return stream
}
