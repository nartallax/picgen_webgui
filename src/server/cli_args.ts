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
		paramsConfig: CLI.path({
			keys: ["--config"],
			definition: "Path to config.json",
			default: "./config.json"
		}),
		httpRootUrl: CLI.str({
			keys: ["--http-root-url"],
			definition: "Override URL for non-API requests. Mainly intended for development.",
			default: ""
		})
	}
})

export type CLIArgs = CliArgObject<typeof cli>

export function getCliArgs(): CLIArgs {
	return cli.parseArgs()
}