import * as Fs from "fs"
import * as Os from "os"
import * as Path from "path"

let username = Os.userInfo().username
let basePath = `${process.env.HOME}/Downloads/highres_`
let imagePaths = [1,2,3,4,5].map(index => basePath + index + ".jpeg")
let images = imagePaths.map(path => Fs.readFileSync(path))
let picDir = "./pictures"

let index = 0
for(let picture of Fs.readdirSync(picDir)){
	let content = images[(index++) % images.length]
	Fs.writeFileSync((Path.resolve(picDir, picture)), content)
}
