import {generateRandomIdentifier} from "common/utils/generate_random_identifier"
import {promises as Fs} from "fs"
import * as Os from "os"
import * as Path from "path"
import {fileExists} from "server/utils/file_exists"

export interface TmpFileData {
	data: Buffer
	ext: string
}

let osTmpdir: string | null = null

function idToFilePath(id: string, ext: string, tmpdir?: string): string {
	tmpdir ??= osTmpdir ??= Os.tmpdir()
	return Path.resolve(tmpdir, id + "." + ext)
}

export async function makeTempFileName(ext: string, tmpdir?: string): Promise<string> {
	const id = await generateRandomIdentifier(id => fileExists(idToFilePath(id, ext, tmpdir)))
	return idToFilePath(id, ext, tmpdir)
}

export async function makeTempFile(data: Buffer, ext: string, tmpdir?: string): Promise<string> {
	const filePath = await makeTempFileName(ext, tmpdir)
	await Fs.writeFile(filePath, data)
	return filePath
}

export async function withTempFiles<T>(files: TmpFileData[], handler: (paths: readonly string[]) => Promise<T>): Promise<T> {
	const paths: string[] = []
	try {
		for(const fileData of files){
			const filePath = await makeTempFile(fileData.data, fileData.ext)
			paths.push(filePath)
		}

		return await handler(paths)
	} finally {
		for(const path of paths){
			await Fs.rm(path)
		}
	}
}