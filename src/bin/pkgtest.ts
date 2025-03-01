import {
	program,
	Command,
	Argument,
	Option,
	InvalidArgumentError,
} from "commander";
import { DEFAULT_CONFIG_FILE_NAME_BASE, LIBRARY_NAME } from "../config";
import { DEFAULT_TIMEOUT, IPreserveResourcesFn, run } from "../run";
import {
	CollectLogFilesOn,
	CollectLogFileStages,
	FailFastError,
	ModuleTypes,
	OnWindowsProblemsAction,
	PkgManager,
	RunWith,
	TestType,
} from "../types";
import { confirm } from "@inquirer/prompts";

interface Options {
	config?: string;
	debug?: boolean;
	failFast?: boolean;
	timeout?: number;
	parallel: number;
	preserve?: boolean;
	ipreserve?: boolean;
	updateLockfiles?: boolean;
	installOnly?: boolean;
	noYarnv1CacheClean?: boolean;
	collectLogFilesOn?: CollectLogFilesOn;
	collectLogFilesStage?: CollectLogFileStages[];
	// Filter options
	modType?: ModuleTypes[];
	noModType?: ModuleTypes[];
	pkgManager?: PkgManager[];
	noPkgManager?: PkgManager[];
	runWith?: RunWith[];
	noRunWith?: RunWith[];
	pkgManagerAlias?: string[];
	noPkgManagerAlias?: string[];
	testType?: TestType[];
	noTestType?: TestType[];
	onWindowsProblems?: OnWindowsProblemsAction;
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
		"-c, --config <path>",
		`The location of the config file for ${LIBRARY_NAME}.  Defaults to looking for ${DEFAULT_CONFIG_FILE_NAME_BASE}.([mc]?js|ts)`,
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
		1,
	)
	.option(
		"--preserve",
		"Preserves all test project directories that were created (use for debugging, but keep in mind this leaves large resources on your hard disk that you have to clean up)",
	)
	.option(
		"--ipreserve",
		"Interactively prompts you at the end of pkgtest on whether or not you want to delete one of the temporary projects",
	)
	.option(
		"--updateLockfiles",
		"Will update any changes to the lock files for the different test projects in your locks.folder (default: <rootdir>/lockfiles)",
	)
	.option(
		"--installOnly",
		"This will only create test projects and then stop.  Keep in mind that, without --preserve, they will be cleaned up.",
	)
	.option(
		"--noYarnv1CacheClean",
		"This is an optimization that should only be done on machines that will be fully cleaned.  yarnv1 will blow up your cache with local file installs if not cleaned.  This will save time though.",
	)
	.addOption(
		new Option(
			"--collectLogFilesOn <on>",
			"pkgtest will scan all stdouts and stderrs of its process calls and will bundle any log files to the collect log files location (default: tempdir/pkgtest-logs or PKG_TEST_LOG_COLLECT_DIR)",
		).choices(Object.values(CollectLogFilesOn)),
	)
	.addOption(
		new Option(
			"--collectLogFilesStage <stages...>",
			"use in conjuction with collectLogFilesOn, this is required for pkgtest to know when to scan and collect stdio for log files.  Note, scanning unnecessary and long outputs will impact performance.",
		).choices(Object.values(CollectLogFileStages)),
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
			"--noModType <modTypes...>",
			"Limits the tests that run to any that don't have the specified module types",
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
			"--noPkgManager <pkgManagers...>",
			"Limits the tests that run to any that don't have the specified base package manager",
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
			"--noRunWith <runWiths...>",
			"Limits the tests that run to any that don't have the specified runWith",
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
			"--noPkgManagerAlias <pkgManagerAliases...>",
			"Limits the tests that run to any that don't have the pkgManager config alias (pkgtest default) runs the string PkgManager configs",
		),
	)
	.addOption(
		new Option(
			"--testType <testType...>",
			"Limits the tests that run to the type of test",
		).choices(Object.values(TestType)),
	)
	.addOption(
		new Option(
			"--noTestType <testType...>",
			"Limits the tests that run to any that don't have the type of test",
		).choices(Object.values(TestType)),
	)
	.addOption(
		new Option(
			"--onWindowsProblems <onProblem>",
			"If we want pkgtest to detect and do something when trying to set up a problematic windows test project",
		).choices(Object.values(OnWindowsProblemsAction)),
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
		const iPreserveResources: IPreserveResourcesFn | undefined =
			options.ipreserve
				? async ({ entry, modType, pkgManager, pkgManagerAlias }) => {
						return !(await confirm({
							message: `Delete pkg for ${entry.alias}: [${modType}, ${pkgManager} (${pkgManagerAlias})]?`,
							default: options.preserve,
						}));
					}
				: undefined;

		try {
			const passed = await run({
				debug: options.debug,
				failFast: options.failFast,
				timeout: options.timeout,
				configPath: options.config,
				preserveResources: options.preserve,
				iPreserveResources,
				updateLocks: !!options.updateLockfiles,
				isCI: false, // TODO: change
				installOnly: options.installOnly,
				noYarnv1CacheClean: options.noYarnv1CacheClean,
				collectLogFilesOn: options.collectLogFilesOn,
				collectLogFilesStages: options.collectLogFilesStage,
				filters: {
					fileTestNames: testMatch ?? [],
					moduleTypes: options.modType,
					noModuleTypes: options.noModType,
					packageManagers: options.pkgManager,
					noPackageManagers: options.noPkgManager,
					runWith: options.runWith,
					noRunWith: options.noRunWith,
					pkgManagerAlias: options.pkgManagerAlias,
					noPkgManagerAlias: options.noPkgManagerAlias,
					testTypes: options.testType,
					noTestTypes: options.noTestType,
					onWindowsProblems: options.onWindowsProblems,
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
