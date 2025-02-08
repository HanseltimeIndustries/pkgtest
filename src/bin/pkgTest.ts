import { program, Command, Argument, Option } from "commander";
import { DEFAULT_CONFIG_FILE_NAME_BASE, LIBRARY_NAME } from "../config";
import { DEFAULT_TIMEOUT, FailFastError, run } from "../run";
import { ModuleTypes, PkgManager, RunBy } from "../types";

interface Options {
	config?: string;
	debug?: boolean;
	failFast?: boolean;
	timeout?: number;
	preserve?: boolean;
	// Filter options
	modType?: ModuleTypes[];
	pkgManager?: PkgManager[];
	runWith?: RunBy[];
	pkgManagerAlias?: string[];
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
	.option(
		"--preserve",
		"Preserves all test project directories that were created (use for debugging, but keep in mind this leaves large resources on your hard disk that you have to clean up)",
	)
	// filters
	.addOption(
		new Option(
			"--modType <modTypes...>",
			"Limits the tests that run to the specified module types",
		).choices(Object.values(ModuleTypes)),
	)
	.addOption(
		new Option(
			"--pkgManager <pkgManagers...>",
			"Limits the tests that run to the specified base package manager",
		).choices(Object.values(PkgManager)),
	)
	.addOption(
		new Option(
			"--runWith <runWiths...>",
			"Limits the tests that run to the specified runWith",
		).choices(Object.values(RunBy)),
	)
	.addOption(
		new Option(
			"--pkgManagerAlias <pkgManagerAliases...>",
			"Limits the tests that run to the pkgManager config alias (pkgtest default) runs the string PkgManager configs",
		),
	)
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
				debug: options.debug,
				failFast: options.failFast,
				timeout: options.timeout,
				configPath: options.config,
				preserveResources: options.preserve,
				filters: {
					testNames: testMatch ?? [],
					moduleTypes: options.modType,
					packageManagers: options.pkgManager,
					runWith: options.runWith,
					pkgManagerAlias: options.pkgManagerAlias,
				},
			});
		} catch (err) {
			if (err instanceof FailFastError) {
				process.exit(44);
			} else {
				throw err;
			}
		}
	});

program.parse();
