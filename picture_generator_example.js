// this is example program that generates pictures!
// it exists to show you, the user of the bot, how to write your picture generating program
// it can be launched with following command:
// node picture_generator_example.js '{"param":"value"}'

// just requesting some libraries from NodeJS
import * as Fs from "fs"
import * as Process from "process"
import {setTimeout} from "timers"

// entrypoint of the picture generator
// this function will be called when picture generator is launched
async function main() {
	// some generation arguments are passed as command-line parameter
	// what they will look like exactly is defined by bot config
	const parameters = JSON.parse(Process.argv[2] || "{}")
	// arbitrary text logs go into stderr
	// stderr logs can be seen in bot's own stderr
	Process.stderr.write("Got arguments! " + JSON.stringify(parameters) + "\n")

	// this is how you can update any argument if you want
	Process.stdout.write(JSON.stringify({modifyTaskArguments: {exclude: "nyom-nyom"}}) + "\n")

	// we can send arbitrary text messages while generating stuff to be displayed to frontend
	Process.stdout.write(JSON.stringify({message: "Hewwo! I'm starting!", displayFor: 10}) + "\n")

	const willGenerateFilesCount = 3
	const totalGenerationTime = 3000

	// let's tell the bot how many pictures to expect
	// if you don't, or tell incorrect number of pictures - it won't break anything
	// it just allows for more beautiful inputs
	Process.stdout.write(JSON.stringify({willGenerateCount: willGenerateFilesCount}) + "\n")

	const timePerPicture = totalGenerationTime / willGenerateFilesCount
	// we also can notify server on how long it will take to generate all the stuff we want to generate
	// we can do it at any time through generation run
	// timeLeft is in seconds

	Process.stdout.write(JSON.stringify({timeLeft: (willGenerateFilesCount * timePerPicture) / 1000}) + "\n")

	// we will generate some pictures
	for(let i = 0; i < willGenerateFilesCount; i++){
		// sleep for 5 seconds
		// implying some generation is going on, it's a slow process, give it some time
		await new Promise(ok => setTimeout(ok, timePerPicture))

		// now let's generate a file!
		// it will actually be the same file every time
		// that we put in the same location every time
		const filePath = `./resulting_picture_example_${i}.png`
		// so, we put some data into file
		await Fs.promises.writeFile(filePath, Buffer.from(pictures[i % pictures.length], "base64"))
		// and then emit JSON into stdout, saying "hey, we just generated a file!"
		// note newline at the end of the string
		// bot expects that each new JSON will be on the next line
		// you can also notify server if you're modified any arguments
		Process.stdout.write(JSON.stringify({
			generatedPicture: filePath,
			modifiedArguments: {prompt: parameters.prompt + " number " + (i + 1)}
		}) + "\n")
	}

	// everything is fine! let's exit normally, with exit code 0
	Process.exit(0)
}

// invocation of the entrypoint function
// because it's not gonna call itself, y'know
main()

// this is base64 of some example pictures that this generator will output
const pictures = [
	"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"
]