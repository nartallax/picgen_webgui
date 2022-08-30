import {CLI, CliArgObject} from "server/utils/cli"

const cli = new CLI({
	helpHeader: "Webserver for picgen web GUI",
	definition: {
		help: CLI.help({
			keys: ["-h", "--h", "-help", "--help"],
			definition: "Display help and exit"
		}),
		httpRootDir: CLI.path({
			keys: ["-r", "--http-root"],
			definition: "Path to directory that is root of static files provided over http",
			default: "./static"
		}),
		port: CLI.int({
			keys: ["-p", "--http-port"],
			definition: "TCP port that the server will listen on",
			default: 22650
		})
	}
})

export type CLIArgs = CliArgObject<typeof cli>

export function getCliArgs(): CLIArgs {
	return cli.parseArgs()
}