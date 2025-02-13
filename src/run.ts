import { tmpdir } from "os";
import { getConfig, LIBRARY_NAME } from "./config";
import { createTestProject } from "./createTestProject";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { FileTestRunner } from "./FileTestRunner";
import { SimpleReporter } from "./reporters/SimpleReporter";
import { Logger } from "./Logger";
import chalk from "chalk";
import { ModuleTypes, PkgManager, RunWith } from "./types";
import { testSuiteDescribe } from "./reporters";
import { getMatchIgnore } from "./getMatchIgnore";
import { ensureMinimumCorepack } from "./pkgManager";
import { BinTestRunner } from "./BinTestRunner";

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
		/**
		 * A glob filter of file names to run (relative to the cwd root)
		 */
		testNames?: string[];
	};
}

export class FailFastError extends Error {}

interface Overview {
	passed: number;
	failed: number;
	notReached: number;
	skipped: number;
	total: number;
}

const DEFAULT_PKG_MANAGER_ALIAS = "pkgtest default";

class TestTypeOverview {
	get passed() {
		this.ensureFinalized();
		return this._passed;
	}
	get failed() {
		this.ensureFinalized();
		return this._failed;
	}
	get notReached() {
		this.ensureFinalized();
		return this._notReached;
	}
	get skipped() {
		this.ensureFinalized();
		return this._skipped;
	}
	get total() {
		this.ensureFinalized();
		return this._total;
	}
	get time() {
		this.ensureFinalized();
		return this._time;
	}
	private _passed = 0;
	private _failed = 0;
	private _notReached = 0;
	private _skipped = 0;
	private _total = 0;
	private _start: Date | undefined;
	private _time: number = 0;
	private _finalized = false;

	addToTotal(n: number) {
		this._total += n;
	}

	startTime() {
		if (this._start) {
			throw new Error("Can only start time once!");
		}
		this._start = new Date();
	}

	pass(n: number) {
		this._passed += n;
		this.ensureNoMonkeyBusiness();
	}

	fail(n: number) {
		this._failed += n;
		this.ensureNoMonkeyBusiness();
	}

	skip(n: number) {
		this._skipped += n;
		this.ensureNoMonkeyBusiness();
	}

	private ensureNoMonkeyBusiness() {
		const sum = this._failed + this._passed + this._skipped;
		if (sum > this._total) {
			throw new Error(
				`Unexpected condition when recording tests! Total of skipped + failed + pass is greater than total: ${this._total}`,
			);
		}
	}

	private ensureFinalized() {
		if (!this._finalized) {
			throw new Error(
				"Must finalize an overview before retrieving its values!",
			);
		}
	}

	finalize() {
		if (this._finalized) {
			return;
		}
		if (this._start) {
			this._time = new Date().getTime() - this._start.getTime();
		}
		this._notReached =
			this._total - (this._failed + this._passed + this._skipped);
		this._finalized = true;
	}
}

export async function run(options: RunOptions) {
	const {
		configPath,
		debug,
		failFast,
		timeout = 2000,
		preserveResources,
		filters = {},
	} = options;
	const { testNames = [] } = filters;
	const logger = new Logger({
		context: "[runner]",
		debug: !!debug,
	});
	logger.logDebug("Retrieving Config...");
	const config = await getConfig(configPath);

	logger.logDebug(JSON.stringify(config));

	const matchIgnore = getMatchIgnore(process.cwd(), config.matchIgnore);
	logger.logDebug(`matchIgnore: ${JSON.stringify(matchIgnore)}`);
	const matchRootDir = config.matchRootDir ?? ".";
	logger.logDebug(`matchRootDir: ${matchRootDir}`);
	const projectDir = process.cwd();

	const tmpDir = process.env.PKG_TEST_TEMP_DIR ?? tmpdir();
	logger.logDebug(`Writing test projects to temporary directory: ${tmpDir}`);

	// Set up the runner contexts
	logger.logDebug(`Initializing test projects...`);
	const fileTestSuitesOverview = new TestTypeOverview();
	const fileTestsOverview = new TestTypeOverview();
	const binTestSuitesOverview = new TestTypeOverview();
	const binTestsOverview = new TestTypeOverview();
	function addSkippedSuite(n: number) {
		fileTestSuitesOverview.addToTotal(n);
		fileTestSuitesOverview.skip(n);
	}
	const startSetup = new Date();
	const testRunnerPkgs = await Promise.all(
		config.entries.reduce(
			(runners, testConfigEntry) => {
				testConfigEntry.moduleTypes.forEach((modType) => {
					// Ensure we don't have duplicate aliases
					const usedPkgManagerAliasMap = Object.values(PkgManager).reduce(
						(used, pkgm) => {
							used.set(pkgm, new Set<string>());
							return used;
						},
						new Map<string, Set<string>>(),
					);
					runners.push(
						...testConfigEntry.packageManagers.map(async (_pkgManager) => {
							const simpleOptions = typeof _pkgManager === "string";
							const pkgManager = simpleOptions
								? _pkgManager
								: _pkgManager.packageManager;
							const pkgManagerOptions = simpleOptions
								? undefined
								: _pkgManager.options;
							const pkgManagerAlias = simpleOptions
								? DEFAULT_PKG_MANAGER_ALIAS
								: _pkgManager.alias;

							// Ensure the alias is unique to the entry
							const usedAliases = usedPkgManagerAliasMap.get(pkgManager);
							if (usedAliases?.has(pkgManagerAlias!)) {
								throw new Error(
									`Cannot provide the same pkgManager alias for ${pkgManager} configuration! ${pkgManagerAlias}`,
								);
							}
							usedAliases?.add(pkgManagerAlias);

							// Apply filters
							if (
								filters.moduleTypes &&
								!filters.moduleTypes.includes(modType)
							) {
								addSkippedSuite(
									skipSuitesNotice(logger, {
										runWith: testConfigEntry.runWith,
										modType,
										pkgManager,
										pkgManagerAlias,
									}),
								);
								return;
							}
							if (
								filters.packageManagers &&
								!filters.packageManagers.includes(pkgManager)
							) {
								addSkippedSuite(
									skipSuitesNotice(logger, {
										runWith: testConfigEntry.runWith,
										modType,
										pkgManager,
										pkgManagerAlias,
									}),
								);
								return;
							}
							if (
								filters.pkgManagerAlias &&
								!filters.pkgManagerAlias.includes(pkgManagerAlias)
							) {
								addSkippedSuite(
									skipSuitesNotice(logger, {
										runWith: testConfigEntry.runWith,
										modType,
										pkgManager,
										pkgManagerAlias,
									}),
								);
								return;
							}
							let runWith = testConfigEntry.runWith;
							if (filters.runWith) {
								runWith = testConfigEntry.runWith.reduce((rWith, runBy) => {
									if (!filters.runWith!.includes(runBy)) {
										addSkippedSuite(
											skipSuitesNotice(logger, {
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
							try {
								const { fileTestRunners, binTestRunner } =
									await createTestProject(
										{
											projectDir,
											testProjectDir,
											debug,
											failFast,
											matchIgnore,
											matchRootDir,
										},
										{
											runBy: runWith,
											modType,
											pkgManager,
											pkgManagerOptions,
											pkgManagerAlias,
											testMatch: testConfigEntry.testMatch,
											typescript: testConfigEntry.transforms.typescript,
											additionalDependencies: {
												...config.additionalDependencies,
												...testConfigEntry.additionalDependencies,
											},
											binTests: testConfigEntry.binTests,
										},
									);
								fileTestSuitesOverview.addToTotal(fileTestRunners.length);
								if (binTestRunner) {
									binTestSuitesOverview.addToTotal(1);
								}
								return {
									fileTestRunners,
									binTestRunner,
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

	const reporter = new SimpleReporter({
		debug,
	});

	// TODO: multi-threading pool for better results, although there's not a large amount of tests necessary at the moment
	try {
		let pass = true;
		fileTestSuitesOverview.startTime();
		for (const testRunnerPkg of testRunnerPkgsFiltered) {
			for (const runner of testRunnerPkg.fileTestRunners) {
				const summary = await runner.runTests({
					timeout,
					testNames,
					reporter,
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
		for (const { binTestRunner } of testRunnerPkgsFiltered) {
			// Since bin Tests are less certain, we filter here
			if (!binTestRunner) continue;
			const summary = await binTestRunner.runTests({
				timeout,
				reporter,
			});
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

function skipSuitesNotice(
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
			`${chalk.yellow("Skipping Suite:")} ${testSuiteDescribe({
				...rest,
				runBy,
			})}`,
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
