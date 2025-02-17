import { tmpdir } from "os";
import { getConfig, LIBRARY_NAME } from "./config";
import { createTestProject } from "./createTestProject";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { FileTestRunner } from "./FileTestRunner";
import { SimpleReporter } from "./reporters/SimpleReporter";
import { Logger } from "./Logger";
import chalk from "chalk";
import {
	FailFastError,
	ModuleTypes,
	PkgManager,
	RunWith,
	TestConfigEntry,
	TestType,
} from "./types";
import { getMatchIgnore } from "./getMatchIgnore";
import { ensureMinimumCorepack } from "./pkgManager";
import { BinTestRunner } from "./BinTestRunner";
import { skipSuiteDescribe } from "./reporters/skipSuitesNotice";
import { TestGroupOverview } from "./reporters";
import { findAdditionalFilesForCopyOver } from "./files";
import { AdditionalFilesCopy } from "./files/types";

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

	// filter abstractions
	const skipFileTests =
		filters.testTypes && !filters.testTypes.includes(TestType.File);
	const skipBinTests =
		filters.testTypes && !filters.testTypes.includes(TestType.Bin);

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
	const testRunnerPkgs = await Promise.all(
		config.entries.reduce(
			(runners, testConfigEntry, entryIdx) => {
				testConfigEntry.moduleTypes.forEach((modType) => {
					runners.push(
						...testConfigEntry.packageManagers.map(async (_pkgManager) => {
							const {
								packageManager: pkgManager,
								alias: pkgManagerAlias,
								options: pkgManagerOptions,
							} = _pkgManager;

							// Apply filters early in case the testType needs no set up
							if (filters.testTypes) {
								if (
									!filters.testTypes.includes(TestType.File) &&
									!testConfigEntry.binTests
								) {
									testEntryProjectLevelSkip(
										logger,
										{
											modType,
											pkgManager,
											pkgManagerAlias,
										},
										testConfigEntry,
										fileTestSuitesOverview,
										binTestSuitesOverview,
									);
									return;
								}
								if (
									!filters.testTypes.includes(TestType.Bin) &&
									!testConfigEntry.fileTests
								) {
									testEntryProjectLevelSkip(
										logger,
										{
											modType,
											pkgManager,
											pkgManagerAlias,
										},
										testConfigEntry,
										fileTestSuitesOverview,
										binTestSuitesOverview,
									);
									return;
								}
							}

							if (
								filters.moduleTypes &&
								!filters.moduleTypes.includes(modType)
							) {
								testEntryProjectLevelSkip(
									logger,
									{
										modType,
										pkgManager,
										pkgManagerAlias,
									},
									testConfigEntry,
									fileTestSuitesOverview,
									binTestSuitesOverview,
								);
								return;
							}
							if (
								filters.packageManagers &&
								!filters.packageManagers.includes(pkgManager)
							) {
								testEntryProjectLevelSkip(
									logger,
									{
										modType,
										pkgManager,
										pkgManagerAlias,
									},
									testConfigEntry,
									fileTestSuitesOverview,
									binTestSuitesOverview,
								);
								return;
							}
							if (
								filters.pkgManagerAlias &&
								!filters.pkgManagerAlias.includes(pkgManagerAlias)
							) {
								testEntryProjectLevelSkip(
									logger,
									{
										modType,
										pkgManager,
										pkgManagerAlias,
									},
									testConfigEntry,
									fileTestSuitesOverview,
									binTestSuitesOverview,
								);
								return;
							}
							if (testConfigEntry.fileTests) {
								if (filters.runWith) {
									// Reset - todo this doesn't preserve idempotency of the config...
									testConfigEntry.fileTests.runWith =
										testConfigEntry.fileTests.runWith.reduce((rWith, runBy) => {
											if (!filters.runWith!.includes(runBy)) {
												fileTestSuitesOverview.addSkippedToTotal(
													skipFileSuitesNotice(logger, {
														runWith: [runBy],
														modType,
														pkgManager,
														pkgManagerAlias,
													}),
												);
											} else {
												rWith.push(runBy);
											}
											return rWith;
										}, [] as RunWith[]);
								}
							}
							// End filters
							const testProjectDir = await mkdtemp(
								join(tmpDir, `${LIBRARY_NAME}-`),
							);
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
									logger.log(
										chalk.yellow(`Skipping deletion of ${testProjectDir}`),
									);
								}
							}
							const entryLevelAdditionalFiles: AdditionalFilesCopy[] =
								testConfigEntry.additionalFiles
									? await findAdditionalFilesForCopyOver({
											additionalFiles: testConfigEntry.additionalFiles,
											projectDir,
											rootDir,
										})
									: [];
							try {
								const { fileTestRunners, binTestRunner } =
									await createTestProject(
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
											entryAlias: `entry${entryIdx}`,
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
											reporter,
											timeout: testConfigEntry.timeout || topLevelTimeout,
											packageJson: {
												...config.packageJson,
												...testConfigEntry.packageJson,
											},
										},
									);

								// Filter out whole test types (since they can be set up in the same project)
								let filteredFileTestRunners: FileTestRunner[];
								if (skipFileTests) {
									fileTestRunners.forEach((ftr) => {
										fileTestSuitesOverview.addSkippedToTotal(1);
										logger.log(skipSuiteDescribe(ftr));
									});
									filteredFileTestRunners = [];
								} else {
									fileTestSuitesOverview.addToTotal(fileTestRunners.length);
									filteredFileTestRunners = fileTestRunners;
								}
								let filteredBinTestRunner: BinTestRunner | undefined;
								if (binTestRunner) {
									if (skipBinTests) {
										binTestSuitesOverview.addSkippedToTotal(1);
										logger.log(skipSuiteDescribe(binTestRunner));
										filteredBinTestRunner = undefined;
									} else {
										filteredBinTestRunner = binTestRunner;
										binTestSuitesOverview.addToTotal(1);
									}
								}
								return {
									fileTestRunners: filteredFileTestRunners,
									binTestRunner: filteredBinTestRunner,
									cleanup,
								};
							} catch (err) {
								await cleanup();
								throw err;
							}
						}),
					);
				});
				return runners;
			},
			[] as Promise<
				| {
						fileTestRunners: FileTestRunner[];
						binTestRunner?: BinTestRunner;
						cleanup: () => Promise<void>;
				  }
				| undefined
			>[],
		),
	);
	const testRunnerPkgsFiltered = testRunnerPkgs.filter((run) => !!run);
	logger.logDebug(`Finished initializing test projects.`);
	const setupTime = new Date().getTime() - startSetup.getTime();

	// TODO: multi-threading pool for better results, although there's not a large amount of tests necessary at the moment
	try {
		let pass = true;
		fileTestSuitesOverview.startTime();
		for (const testRunnerPkg of testRunnerPkgsFiltered) {
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
		// Run bin tests as well
		binTestSuitesOverview.startTime();
		for (const { binTestRunner } of testRunnerPkgsFiltered) {
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
			testRunnerPkgsFiltered.map(async ({ cleanup }) => {
				await cleanup();
			}),
		);
	}
}

function skipFileSuitesNotice(
	logger: Logger,
	opts: {
		runWith: RunWith[];
		modType: ModuleTypes;
		pkgManager: PkgManager;
		pkgManagerAlias: string;
	},
): number {
	const { runWith, ...rest } = opts;
	runWith.forEach((runBy) => {
		logger.log(
			skipSuiteDescribe({
				...rest,
				runBy,
			}),
		);
	});
	return runWith.length;
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

/**
 * Used to indicate that we're skipping all tests related to a single project that would be created
 */
function testEntryProjectLevelSkip(
	logger: Logger,
	context: {
		modType: ModuleTypes;
		pkgManager: PkgManager;
		pkgManagerAlias: string;
	},
	config: TestConfigEntry,
	fileTestsSuiteOverview: TestGroupOverview,
	binTestsSuiteOverview: TestGroupOverview,
) {
	if (config.fileTests) {
		fileTestsSuiteOverview.addSkippedToTotal(
			skipFileSuitesNotice(logger, {
				runWith: config.fileTests.runWith,
				...context,
			}),
		);
	}
	if (config.binTests) {
		binTestsSuiteOverview.addSkippedToTotal(1);
		logger.log(
			skipSuiteDescribe({
				...context,
				binTestConfig: config.binTests,
			}),
		);
	}
}
