import { program, Command, Argument } from "commander";
import { DEFAULT_CONFIG_FILE_NAME_BASE, LIBRARY_NAME } from "../config";
import { DEFAULT_TIMEOUT, FailFastError, run } from "../run";

interface Options {
	config?: string;
	debug?: boolean;
	failFast?: boolean;
	timeout?: number;
	preserve?: boolean
}

program
	.option(
		`-c, --config <path>', 'The location of the config file for ${LIBRARY_NAME}.  Defaults to looking for ${DEFAULT_CONFIG_FILE_NAME_BASE}.([mc]?js|ts)`,
	)
	.option("--debug", "Adds more logging for each test that runs")
	.option("--failFast", "Immediately stops test execution on the first failure")
	.option(
		`-t, --timeout <ms>', 'The max time in milliseconds to wait for a test to run (does not include test package folder set up).  Defaults to: ${DEFAULT_TIMEOUT}`,
	)
	.option('--preserve', "Preserves all test project directories that were created (use for debugging, but keep in mind this leaves large resources on your hard disk that you have to clean up)")
	.addArgument(
		new Argument(
			"<testMatch...>",
			"If you specify a glob pattern, only test files that match the pattern will be run",
		)
			.argOptional()
			.default([]),
	)
	.action(async (testMatch: string[], options: Options, _command: Command) => {
		try {
		await run({
			testNames: testMatch ?? [],
			debug: options.debug,
			failFast: options.failFast,
			timeout: options.timeout,
			configPath: options.config,
			preserveResources: options.preserve,
		});
	} catch (err) {
		if (err instanceof FailFastError) {
			process.exit(44)
		} else {
			throw err
		}
	}
	});

program.parse();
