import {promises as Fs} from "fs"
import {isEnoent} from "server/utils/is_enoent"

export async function fileExists(path: string): Promise<boolean> {
	try {
		const stat = await Fs.stat(path)
		if(!stat.isFile()){
			throw new Error(path + " exists, but it's not a file! Don't know how to react to that.")
		}
		return true
	} catch(e){
		if(isEnoent(e)){
			return false
		}
		throw e
	}
}