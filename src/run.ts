import { getConfig, StandardizedTestConfigEntry } from "./config";
import { createTestProject } from "./createTestProject";
import { mkdtemp } from "fs/promises";
import { join, resolve } from "path";
import { BinTestRunner, FileTestRunner, ScriptTestRunner } from "./runners";
import { SimpleReporter } from "./reporters/SimpleReporter";
import { Logger } from "./logging";
import chalk from "chalk";
import {
	AddFilePerTestProjectCreate,
	AdditionalFilesEntry,
	ModuleTypes,
	PkgManager,
} from "./types";
import { getMatchIgnore } from "./getMatchIgnore";
import {
	ensureMinimumCorepack,
	getPkgManagerCommand,
	getPkgManagers,
	LatestResolvedTestConfigEntry,
	resolveLatestVersions,
} from "./pkgManager";
import { TestGroupOverview } from "./reporters";
import {
	findAdditionalFilesForCopyOver,
	getLogCollectFolder,
	getTempProjectDirPrefix,
} from "./files";
import { AdditionalFilesCopy } from "./files/types";
import {
	applyFiltersToEntries,
	EntryFilterOptions,
} from "./applyFiltersToEntries";
import { groupSyncInstallEntries } from "./groupSyncInstallEntries";
import { mkdirSync, readFileSync, rmSync } from "fs";
import { PackageJson } from "type-fest";
import { execSync } from "child_process";
import { getTempDir } from "./files";
import { executeRunners } from "./executeRunners";
import { CollectLogFilesOn, CollectLogFilesOptions } from "./controlledExec";

export const DEFAULT_TIMEOUT = 2000;

const INTERRUPT_EVENTS = [
	`exit`,
	`SIGINT`,
	`SIGUSR1`,
	`SIGUSR2`,
	`uncaughtException`,
	`SIGTERM`,
];

export type IPreserveResourcesFn = (options: {
	entry: StandardizedTestConfigEntry;
	pkgManager: PkgManager;
	pkgManagerAlias: string;
	pkgManagerVersion: string;
	modType: ModuleTypes;
}) => Promise<boolean>;

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
	 * This means we will create the test projects and then end.  This is helpful for 2 scenarios:
	 *
	 * 1. If you just want to have a test project created and then access it afterwards to test config with "--preserve"
	 * 2. If you want to pre-cache dependencies before running tests separately
	 */
	installOnly?: boolean;
	/**
	 * Yarn v1 will aggresively expand its local cache when doing the import of the packages.  As a result,
	 * we make sure to run a yarn cache clean <our package under test> before finishing the program.  You can turn
	 * this off if you are running in an ephemeral environment and would like to save some time.
	 */
	noYarnv1CacheClean?: boolean;
	/**
	 * If set to true, this will not clean up the test project directories that were created
	 *
	 * Important! Only use this for debugging pkgtests or in containers that will have their volumes cleaned up
	 * directly after running in a short lived environment.  This will populate your temporary directory with
	 * large amounts of node modules, etc.
	 */
	preserveResources?: boolean;
	/**
	 * Interactive Preserve resources -
	 */
	iPreserveResources?: IPreserveResourcesFn;
	/**
	 * The max amount of time for a test to run (keep in mind, this is just the call to running the pkgTest script
	 * and not installation)
	 *
	 * Defaults to 2000
	 */
	timeout?: number;
	/**
	 * If set, pkgtest will scan logs during setup calls for any detected log files and then copy them to the
	 * log collection folder on the system when:
	 *
	 * - Error - only an error triggers a failure of an exec
	 * - All - any time we see a log file mentioned regardless of failure
	 *
	 * Note: this is mainly meant for CI processes
	 */
	collectSetupLogFilesOn?: CollectLogFilesOn;
	/**
	 * The number of test suites to run in parallel
	 */
	parallel: number;
	/**
	 * The path of the config file to use - if not supplied obeys default search rules
	 */
	configPath?: string;
	/**
	 * For every supplied filter, the tests that would be created via the configs will be paired down to only thouse
	 * that match all filters provided
	 */
	filters?: EntryFilterOptions & {
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
		iPreserveResources,
		collectSetupLogFilesOn,
		filters = {},
	} = options;
	// Store clean up functions that can be async
	const asyncCleanUps: (() => Promise<void>)[] = [];
	// Signal handling cleanup is only guaranteed with sync
	const onSigCleanUps: (() => void)[] = [];
	async function runCleanup() {
		for (const cleanUp of onSigCleanUps) {
			try {
				cleanUp();
			} catch (err) {
				console.error("Error with cleanup!" + err);
			}
		}
	}
	INTERRUPT_EVENTS.forEach((eventType) => {
		process.once(eventType, runCleanup);
	});
	const topLevelTimeout = options.timeout || DEFAULT_TIMEOUT;
	const { fileTestNames: testNames = [] } = filters;
	const logger = new Logger({
		context: "[runner]",
		debug: !!debug,
	});
	// Log file collection config
	let collectLogOptions: false | Omit<CollectLogFilesOptions, "subFolder"> =
		false;
	if (collectSetupLogFilesOn) {
		const collectLogTopFolder = resolve(
			getLogCollectFolder(),
			"run-" + new Date().getTime(),
		);
		mkdirSync(collectLogTopFolder, {
			recursive: true,
		});
		logger.log(`Collecting logs to ${collectLogTopFolder} for this run`);
		collectLogOptions = {
			on: collectSetupLogFilesOn,
			toFolder: collectLogTopFolder,
		};
	}
	try {
		logger.logDebug("Retrieving Config...");
		const config = await getConfig(configPath);

		logger.logDebug(JSON.stringify(config));

		const matchIgnore = getMatchIgnore(process.cwd(), config.matchIgnore);
		logger.logDebug(`matchIgnore: ${JSON.stringify(matchIgnore)}`);
		const rootDir = config.rootDir ?? ".";
		logger.logDebug(`rootDir: ${rootDir}`);
		const projectDir = process.cwd();
		const { name: packageUnderTestName } = JSON.parse(
			readFileSync(join(projectDir, "package.json")).toString(),
		) as PackageJson;

		const tmpDir = getTempDir();
		logger.logDebug(`Writing test projects to temporary directory: ${tmpDir}`);

		// Scan additionalFiles
		const topLevelAdditionalFiles: AdditionalFilesCopy[] =
			config.additionalFiles
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
		const scriptTestSuitesOverview = new TestGroupOverview();
		const scriptTestsOverview = new TestGroupOverview();
		const reporter = new SimpleReporter({
			debug,
		});
		const startSetup = new Date();
		const filteredEntries = await resolveLatestVersions(
			tmpDir,
			applyFiltersToEntries(
				config.entries,
				{
					fileTestSuitesOverview,
					binTestSuitesOverview,
					scriptTestSuitesOverview,
					logger,
				},
				filters,
			),
			new Logger({
				context: "[resolve latest pkg manager]",
				debug: !!debug,
			}),
			collectLogOptions,
		);

		const usedPkgManagers = getPkgManagers(filteredEntries);

		async function initializeOneEntry(
			modType: ModuleTypes,
			_pkgManager: LatestResolvedTestConfigEntry["packageManagers"][0],
			testConfigEntry: LatestResolvedTestConfigEntry,
		) {
			const {
				packageManager: pkgManager,
				alias: pkgManagerAlias,
				version: pkgManagerVersion,
				options: pkgManagerOptions,
			} = _pkgManager;
			// End filters
			const testProjectDir = await mkdtemp(
				join(tmpDir, getTempProjectDirPrefix()),
			);
			// Ensure that this directory has access to the correct corepack
			ensureMinimumCorepack({
				cwd: testProjectDir,
			});
			let cleanCalled = false;
			function baseCleanUp(preserve: boolean) {
				if (cleanCalled) {
					return;
				}
				if (!preserve) {
					rmSync(testProjectDir, {
						force: true,
						recursive: true,
					});
					logger.logDebug(`Cleaned up ${testProjectDir}`);
				} else {
					logger.log(chalk.yellow(`Skipping deletion of ${testProjectDir}`));
				}
				cleanCalled = true;
			}
			async function asyncCleanUp() {
				if (cleanCalled) {
					return;
				}
				let preserve = !!preserveResources;
				if (iPreserveResources) {
					preserve = await iPreserveResources({
						pkgManager,
						pkgManagerAlias,
						pkgManagerVersion,
						modType,
						entry: testConfigEntry,
					});
				}
				baseCleanUp(preserve);
			}
			async function cleanup() {
				baseCleanUp(!!preserveResources);
			}
			// Add clean up to the process exit handler
			onSigCleanUps.push(cleanup);
			asyncCleanUps.push(asyncCleanUp);
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

			const { fileTestRunners, binTestRunner, scriptTestRunner } =
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
						entryAlias: testConfigEntry.alias,
						config,
						collectLogFiles: collectLogOptions,
					},
					{
						modType,
						pkgManager,
						pkgManagerOptions,
						pkgManagerAlias,
						pkgManagerVersion,
						fileTests: testConfigEntry.fileTests,
						binTests: testConfigEntry.binTests,
						scriptTests: testConfigEntry.scriptTests,
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
			return {
				fileTestRunners,
				binTestRunner,
				scriptTestRunner,
			};
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
						scriptTestRunner?: ScriptTestRunner;
					}>[],
				);
			} else {
				const initReturn = [] as Promise<{
					fileTestRunners: FileTestRunner[];
					binTestRunner?: BinTestRunner;
					scriptTestRunner?: ScriptTestRunner;
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
		// Also add the yarn cache clean up once here
		if (usedPkgManagers.includes(PkgManager.YarnV1)) {
			const yarnv1CacheCleanup = () => {
				if (!options.noYarnv1CacheClean) {
					// yarn-v1 bloats caches aggressively with file inclusion
					logger.log(`Cleaning up yarn-v1 package cache disk leak...`);
					execSync(
						`${getPkgManagerCommand(PkgManager.YarnV1)} cache clean ${packageUnderTestName}`,
						{
							stdio: "pipe",
						},
					);
				}
			};
			onSigCleanUps.push(yarnv1CacheCleanup);
			asyncCleanUps.push(async () => yarnv1CacheCleanup());
		}

		logger.logDebug(`Finished initializing test projects.`);
		const setupTime = new Date().getTime() - startSetup.getTime();
		if (options.installOnly) {
			return true;
		}

		try {
			const runnerCtx = {
				logger,
				parallel: options.parallel,
			};
			const fileTestRunners = testRunnerPkgs.reduce(
				(runners, testRunnerPkg) => {
					runners.push(...testRunnerPkg.fileTestRunners);
					return runners;
				},
				[] as FileTestRunner[],
			);
			const binTestRunners = testRunnerPkgs
				.map((trp) => trp.binTestRunner)
				.filter((r) => !!r);
			const scriptTestRunners = testRunnerPkgs
				.map((trp) => trp.scriptTestRunner)
				.filter((r) => !!r);
			// file tests
			const fileTestsPass = await executeRunners(
				fileTestRunners,
				fileTestSuitesOverview,
				fileTestsOverview,
				runnerCtx,
				{
					testNames,
				},
			);
			// bin tests
			const binTestsPass = await executeRunners(
				binTestRunners,
				binTestSuitesOverview,
				binTestsOverview,
				runnerCtx,
				undefined,
			);
			// script Tests
			const scriptTestsPass = await executeRunners(
				scriptTestRunners,
				scriptTestSuitesOverview,
				scriptTestsOverview,
				runnerCtx,
				undefined,
			);
			return fileTestsPass && scriptTestsPass && binTestsPass;
		} finally {
			// Do a final report
			fileTestsOverview.finalize();
			fileTestSuitesOverview.finalize();
			binTestSuitesOverview.finalize();
			binTestsOverview.finalize();
			scriptTestSuitesOverview.finalize();
			scriptTestsOverview.finalize();

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
			overviewNotice(
				logger,
				"Script Test Suites:".padEnd(labelLength, " "),
				scriptTestSuitesOverview,
			);
			overviewNotice(
				logger,
				"Script Tests:".padEnd(labelLength, " "),
				scriptTestsOverview,
			);
			logger.log(`${"Setup Time:".padEnd(labelLength)} ${setupTime / 1000} s`);
			logger.log(
				`${"File Test Time:".padEnd(labelLength)} ${fileTestSuitesOverview.time / 1000} s`,
			);
			logger.log(
				`${"Bin Test Time:".padEnd(labelLength)} ${binTestSuitesOverview.time / 1000} s`,
			);
			logger.log(
				`${"Script Test Time:".padEnd(labelLength)} ${scriptTestSuitesOverview.time / 1000} s`,
			);
		}
	} finally {
		// Run async cleanup for normal removal and interactivity
		// Since we're doing potentially interations, we run it sync
		for (const asyncCleanUp of asyncCleanUps) {
			await asyncCleanUp();
		}
		// Remove our interrupt handler since we don't need it anymore
		INTERRUPT_EVENTS.forEach((eventType) => {
			process.removeListener(eventType, runCleanup);
		});
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
