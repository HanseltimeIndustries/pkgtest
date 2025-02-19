import {
	program,
	Command,
	Argument,
	Option,
	InvalidArgumentError,
} from "commander";
import { DEFAULT_CONFIG_FILE_NAME_BASE, LIBRARY_NAME } from "../config";
import { DEFAULT_TIMEOUT, run } from "../run";
import {
	FailFastError,
	ModuleTypes,
	PkgManager,
	RunWith,
	TestType,
} from "../types";

interface Options {
	config?: string;
	debug?: boolean;
	failFast?: boolean;
	timeout?: number;
	parallel: number;
	preserve?: boolean;
	updateLockfiles?: boolean;
	installOnly?: boolean;
	// Filter options
	modType?: ModuleTypes[];
	pkgManager?: PkgManager[];
	runWith?: RunWith[];
	pkgManagerAlias?: string[];
	testType?: TestType[];
}

function parseIntArg(value: string, _prev?: number): number {
	const parsedValue = parseInt(value, 10);
	if (isNaN(parsedValue)) {
		throw new InvalidArgumentError("Not a number.");
	}
	if (parsedValue <= 0) {
		throw new InvalidArgumentError("Must be a positive integer.");
	}
	return parsedValue;
}

program
	.option(
		`-c, --config <path>', 'The location of the config file for ${LIBRARY_NAME}.  Defaults to looking for ${DEFAULT_CONFIG_FILE_NAME_BASE}.([mc]?js|ts)`,
	)
	.option("--debug", "Adds more logging for each test that runs")
	.option("--failFast", "Immediately stops test execution on the first failure")
	.option(
		"-t, --timeout <ms>",
		`The max time in milliseconds to wait for a test to run (does not include test package folder set up).  Defaults to: ${DEFAULT_TIMEOUT}`,
		parseIntArg,
	)
	.option(
		"-p, --parallel <parallel>",
		"The max number of suites to run at once",
		parseIntArg,
		4,
	)
	.option(
		"--preserve",
		"Preserves all test project directories that were created (use for debugging, but keep in mind this leaves large resources on your hard disk that you have to clean up)",
	)
	.option(
		"--updateLockfiles",
		"Will update any changes to the lock files for the different test projects in your locks.folder (default: <rootdir>/lockfiles)",
	)
	.option(
		"--installOnly",
		"This will only create test projects and then stop.  Keep in mind that, without --preserve, they will be cleaned up."
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
		).choices(Object.values(RunWith)),
	)
	.addOption(
		new Option(
			"--pkgManagerAlias <pkgManagerAliases...>",
			"Limits the tests that run to the pkgManager config alias (pkgtest default) runs the string PkgManager configs",
		),
	)
	.addOption(
		new Option(
			"--testType <testType...>",
			"Limits the tests that run to the type of test",
		).choices(Object.values(TestType)),
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
			const passed = await run({
				debug: options.debug,
				failFast: options.failFast,
				timeout: options.timeout,
				configPath: options.config,
				preserveResources: options.preserve,
				updateLocks: !!options.updateLockfiles,
				isCI: false, // TODO: change
				installOnly: options.installOnly,
				filters: {
					fileTestNames: testMatch ?? [],
					moduleTypes: options.modType,
					packageManagers: options.pkgManager,
					runWith: options.runWith,
					pkgManagerAlias: options.pkgManagerAlias,
					testTypes: options.testType,
				},
				parallel: options.parallel,
			});
			if (!passed) {
				process.exit(44);
			}
		} catch (err) {
			if (err instanceof FailFastError) {
				process.exit(44);
			} else {
				throw err;
			}
		}
	});

program.parse();
