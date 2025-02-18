import { tmpdir } from "os";
import { getConfig, LIBRARY_NAME, StandardizedTestConfigEntry } from "./config";
import { createTestProject } from "./createTestProject";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { FileTestRunner } from "./FileTestRunner";
import { SimpleReporter } from "./reporters/SimpleReporter";
import { Logger } from "./Logger";
import chalk from "chalk";
import {
	AddFilePerTestProjectCreate,
	AdditionalFilesEntry,
	FailFastError,
	ModuleTypes,
	PkgManager,
	RunWith,
	TestType,
} from "./types";
import { getMatchIgnore } from "./getMatchIgnore";
import { ensureMinimumCorepack } from "./pkgManager";
import { BinTestRunner } from "./BinTestRunner";
import { TestGroupOverview } from "./reporters";
import { findAdditionalFilesForCopyOver } from "./files";
import { AdditionalFilesCopy } from "./files/types";
import { applyFiltersToEntries } from "./applyFiltersToEntries";
import { groupSyncInstallEntries } from "./groupSyncInstallEntries";

export const DEFAULT_TIMEOUT = 2000;

export interface RunOptions {
	/**
	 * If set to true, this provides additional levels of logging (i.e. the stdout of each test)
	 */
	debug?: boolean;
	/**
	 * Immediately stop running tests after a failure
	 */
	failFast?: boolean;
	/**
	 * If set to true, and locks: false is not set in the config, this will update any changes to the lock files in test
	 * projects to the lockfiles folder
	 */
	updateLocks?: boolean;
	/**
	 * If true, we've detected a ci environment - used for some determinations around yarn install
	 */
	isCI: boolean;
	/**
	 * If set to true, this will not clean up the test project directories that were created
	 *
	 * Important! Only use this for debugging pkgtests or in containers that will have their volumes cleaned up
	 * directly after running in a short lived environment.  This will populate your temporary directory with
	 * large amounts of node modules, etc.
	 */
	preserveResources?: boolean;
	/**
	 * The max amount of time for a test to run (keep in mind, this is just the call to running the pkgTest script
	 * and not installation)
	 *
	 * Defaults to 2000
	 */
	timeout?: number;
	/**
	 * The path of the config file to use - if not supplied obeys default search rules
	 */
	configPath?: string;
	/**
	 * For every supplied filter, the tests that would be created via the configs will be paired down to only thouse
	 * that match all filters provided
	 */
	filters?: {
		moduleTypes?: ModuleTypes[];
		packageManagers?: PkgManager[];
		runWith?: RunWith[];
		pkgManagerAlias?: string[];
		testTypes?: TestType[];
		/**
		 * A glob filter of file names to run (relative to the cwd root)
		 */
		fileTestNames?: string[];
		/**
		 * A string match/regex filter to only run bins that match
		 */
		binTestNames?: string[];
	};
}

interface Overview {
	passed: number;
	failed: number;
	notReached: number;
	skipped: number;
	total: number;
}

export async function run(options: RunOptions) {
	const {
		configPath,
		debug,
		failFast,
		preserveResources,
		filters = {},
	} = options;
	const topLevelTimeout = options.timeout || DEFAULT_TIMEOUT;
	const { fileTestNames: testNames = [] } = filters;
	const logger = new Logger({
		context: "[runner]",
		debug: !!debug,
	});
	logger.logDebug("Retrieving Config...");
	const config = await getConfig(configPath);

	logger.logDebug(JSON.stringify(config));

	const matchIgnore = getMatchIgnore(process.cwd(), config.matchIgnore);
	logger.logDebug(`matchIgnore: ${JSON.stringify(matchIgnore)}`);
	const rootDir = config.rootDir ?? ".";
	logger.logDebug(`rootDir: ${rootDir}`);
	const projectDir = process.cwd();

	const tmpDir = process.env.PKG_TEST_TEMP_DIR ?? tmpdir();
	logger.logDebug(`Writing test projects to temporary directory: ${tmpDir}`);

	// Scan additionalFiles
	const topLevelAdditionalFiles: AdditionalFilesCopy[] = config.additionalFiles
		? await findAdditionalFilesForCopyOver({
				additionalFiles: config.additionalFiles,
				projectDir,
				rootDir,
			})
		: [];

	// Coerce the lockfile object to default true
	const lock:
		| false
		| {
				folder: string;
		  } =
		config.locks === true
			? {
					folder: "lockfiles",
				}
			: config.locks;

	// Set up the runner contexts
	logger.logDebug(`Initializing test projects...`);
	const fileTestSuitesOverview = new TestGroupOverview();
	const fileTestsOverview = new TestGroupOverview();
	const binTestSuitesOverview = new TestGroupOverview();
	const binTestsOverview = new TestGroupOverview();
	const reporter = new SimpleReporter({
		debug,
	});
	const startSetup = new Date();
	const filteredEntries = applyFiltersToEntries(
		config.entries,
		{
			fileTestSuitesOverview,
			binTestSuitesOverview,
			logger,
		},
		filters,
	);

	async function initializeOneEntry(
		modType: ModuleTypes,
		_pkgManager: StandardizedTestConfigEntry["packageManagers"][0],
		testConfigEntry: StandardizedTestConfigEntry,
	) {
		const {
			packageManager: pkgManager,
			alias: pkgManagerAlias,
			options: pkgManagerOptions,
		} = _pkgManager;
		// End filters
		const testProjectDir = await mkdtemp(join(tmpDir, `${LIBRARY_NAME}-`));
		// Ensure that this directory has access to the correct corepack
		ensureMinimumCorepack({
			cwd: testProjectDir,
		});
		async function cleanup() {
			// Clean up the folder
			if (!preserveResources) {
				logger.logDebug(`Cleaning up ${testProjectDir}`);
				await rm(testProjectDir, {
					force: true,
					recursive: true,
				});
			} else {
				logger.log(chalk.yellow(`Skipping deletion of ${testProjectDir}`));
			}
		}
		const entryLevelAdditionalFiles: AdditionalFilesCopy[] = [];
		let entryLevelCreateAdditionalFiles: AddFilePerTestProjectCreate[] = [];
		if (testConfigEntry.additionalFiles) {
			const { copyAdditionalFiles, createAdditionalFiles } =
				testConfigEntry.additionalFiles.reduce(
					(fileTypees, af) => {
						if (typeof af === "function") {
							fileTypees.createAdditionalFiles.push(
								af as AddFilePerTestProjectCreate,
							);
						} else {
							fileTypees.copyAdditionalFiles.push(af);
						}
						return fileTypees;
					},
					{
						copyAdditionalFiles: [] as AdditionalFilesEntry[],
						createAdditionalFiles: [] as AddFilePerTestProjectCreate[],
					},
				);
			entryLevelCreateAdditionalFiles.push(...createAdditionalFiles);
			entryLevelAdditionalFiles.push(
				...(await findAdditionalFilesForCopyOver({
					additionalFiles: copyAdditionalFiles,
					projectDir,
					rootDir,
				})),
			);
		}

		try {
			const { fileTestRunners, binTestRunner } = await createTestProject(
				{
					projectDir,
					testProjectDir,
					debug,
					failFast,
					matchIgnore,
					rootDir,
					updateLock: !!options.updateLocks,
					isCI: options.isCI,
					lock,
					entryAlias: testConfigEntry.alias,
					config,
				},
				{
					modType,
					pkgManager,
					pkgManagerOptions,
					pkgManagerAlias,
					fileTests: testConfigEntry.fileTests,
					binTests: testConfigEntry.binTests,
					additionalFiles: [
						...topLevelAdditionalFiles,
						...entryLevelAdditionalFiles,
					],
					createAdditionalFiles: entryLevelCreateAdditionalFiles,
					reporter,
					timeout: testConfigEntry.timeout || topLevelTimeout,
					packageJson: {
						...config.packageJson,
						...testConfigEntry.packageJson,
					},
				},
			);
			if (binTestRunner) {
				binTestSuitesOverview.addToTotal(1);
			}
			fileTestSuitesOverview.addToTotal(fileTestRunners.length);
			return {
				fileTestRunners,
				binTestRunner,
				cleanup,
			};
		} catch (err) {
			await cleanup();
			throw err;
		}
	}

	// Since yarn-v1 has parallelism issues on install, we want to run yarn-v1 in sync
	const entryGroups = groupSyncInstallEntries(filteredEntries);

	const testGroupExecs = entryGroups.map(async ({ parallel, entries }) => {
		if (parallel) {
			return entries.reduce(
				(runners, testConfigEntry) => {
					testConfigEntry.moduleTypes.forEach((modType) => {
						runners.push(
							...testConfigEntry.packageManagers.map(async (pkgManager) => {
								return await initializeOneEntry(
									modType,
									pkgManager,
									testConfigEntry,
								);
							}),
						);
					});
					return runners;
				},
				[] as Promise<{
					fileTestRunners: FileTestRunner[];
					binTestRunner?: BinTestRunner;
					cleanup: () => Promise<void>;
				}>[],
			);
		} else {
			const initReturn = [] as Promise<{
				fileTestRunners: FileTestRunner[];
				binTestRunner?: BinTestRunner;
				cleanup: () => Promise<void>;
			}>[];
			for (const testConfigEntry of entries) {
				for (const modType of testConfigEntry.moduleTypes) {
					for (const pkgManager of testConfigEntry.packageManagers) {
						logger.logDebug(
							`Running modType ${modType}, pkgManager ${pkgManager.packageManager} (${pkgManager.alias}) in series`,
						);
						const prom = initializeOneEntry(
							modType,
							pkgManager,
							testConfigEntry,
						);
						initReturn.push(prom);
						await prom;
					}
				}
			}
			return initReturn;
		}
	});

	const allExecs = [];
	for (const testGroupExec of testGroupExecs) {
		allExecs.push(...(await testGroupExec));
	}

	const testRunnerPkgs = await Promise.all(allExecs);
	logger.logDebug(`Finished initializing test projects.`);
	const setupTime = new Date().getTime() - startSetup.getTime();

	// TODO: multi-threading pool for better results, although there's not a large amount of tests necessary at the moment
	try {
		let pass = true;
		fileTestSuitesOverview.startTime();
		for (const testRunnerPkg of testRunnerPkgs) {
			for (const runner of testRunnerPkg.fileTestRunners) {
				const summary = await runner.runTests({
					testNames,
				});
				// Do all tests updating
				if (summary.failed > 0) {
					fileTestSuitesOverview.fail(1);
					pass = false;
				} else {
					fileTestSuitesOverview.pass(1);
				}
				fileTestsOverview.addToTotal(summary.total);
				fileTestsOverview.fail(summary.failed);
				fileTestsOverview.pass(summary.passed);
				fileTestsOverview.skip(summary.skipped);

				if (summary.failedFast) {
					// Fail normally instead of letting an error make it to the top
					logger.log("Tests failed fast");
					throw new FailFastError("Tests failed fast");
				}
			}
		}
		fileTestSuitesOverview.finalize();
		// Run bin tests as well
		binTestSuitesOverview.startTime();
		for (const { binTestRunner } of testRunnerPkgs) {
			// Since bin Tests are less certain, we filter here
			if (!binTestRunner) continue;
			const summary = await binTestRunner.runTests();
			// Do all tests updating
			if (summary.failed > 0) {
				binTestSuitesOverview.fail(1);
				pass = false;
			} else {
				binTestSuitesOverview.pass(1);
			}
			binTestsOverview.addToTotal(summary.total);
			binTestsOverview.fail(summary.failed);
			binTestsOverview.pass(summary.passed);
			binTestsOverview.skip(summary.skipped);

			if (summary.failedFast) {
				// Fail normally instead of letting an error make it to the top
				logger.log("Tests failed fast");
				throw new FailFastError("Tests failed fast");
			}
		}
		binTestSuitesOverview.finalize();
		return pass;
	} finally {
		// Do a final report
		fileTestsOverview.finalize();
		fileTestSuitesOverview.finalize();
		binTestSuitesOverview.finalize();
		binTestsOverview.finalize();

		const labelLength = 20;
		overviewNotice(
			logger,
			"File Test Suites:".padEnd(labelLength, " "),
			fileTestSuitesOverview,
		);
		overviewNotice(
			logger,
			"File Tests:".padEnd(labelLength, " "),
			fileTestsOverview,
		);
		overviewNotice(
			logger,
			"Bin Test Suites:".padEnd(labelLength, " "),
			binTestSuitesOverview,
		);
		overviewNotice(
			logger,
			"Bin Tests:".padEnd(labelLength, " "),
			binTestsOverview,
		);
		logger.log(`${"Setup Time:".padEnd(labelLength)} ${setupTime / 1000} s`);
		logger.log(
			`${"File Test Time:".padEnd(labelLength)} ${fileTestSuitesOverview.time / 1000} s`,
		);
		logger.log(
			`${"Bin Test Time:".padEnd(labelLength)} ${binTestSuitesOverview.time / 1000} s`,
		);

		// Cleanup async
		await Promise.allSettled(
			testRunnerPkgs.map(async ({ cleanup }) => {
				await cleanup();
			}),
		);
	}
}

function overviewNotice(logger: Logger, prefix: string, overview: Overview) {
	logger.log(
		`${prefix}${
			overview.failed ? chalk.red(overview.failed + " failed") + ", " : ""
		}${
			overview.skipped ? chalk.yellow(overview.skipped + " skipped" + ", ") : ""
		}${
			overview.notReached
				? chalk.gray(overview.notReached + " not reached" + ", ")
				: ""
		}${chalk.green(overview.passed + " passed,")} ${overview.total} total`,
	);
}
