import { tmpdir } from "os";
import { getConfig, LIBRARY_NAME } from "./config";
import { createTestProject } from "./createTestProject";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { TestRunner } from "./TestRunner";
import { SimpleReporter } from "./reporters/SimpleReporter";
import { Logger } from "./Logger";
import chalk from "chalk";
import { ModuleTypes, PkgManager, RunBy } from "./types";

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
		runWith?: RunBy[];
		/**
		 * A glob filter of file names to run (relative to the cwd root)
		 */
		testNames?: string[];
	};
}

export class FailFastError extends Error {}

export async function run(options: RunOptions) {
	const {
		configPath,
		debug,
		failFast,
		timeout = 2000,
		preserveResources,
		filters = {},
	} = options;
	const { testNames = [], moduleTypes, packageManagers, runWith } = filters;
	const logger = new Logger({
		context: "[runner]",
		debug: !!debug,
	});
	logger.logDebug("Retrieving Config...");
	const config = await getConfig(configPath);

	logger.logDebug(JSON.stringify(config));

	const tmpDir = process.env.PKG_TEST_TEMP_DIR ?? tmpdir();
	logger.logDebug(`Writing test projects to temporary directory: ${tmpDir}`);

	// Set up the runner contexts
	logger.logDebug(`Initializing test projects...`);
	const testRunnerPkgs = await Promise.all(
		config.entries.reduce(
			(runners, testConfigEntry) => {
				testConfigEntry.moduleTypes.forEach((modType) => {
					runners.push(
						...testConfigEntry.packageManagers.map(async (_pkgManager) => {
							const testProjectDir = await mkdtemp(
								join(tmpDir, `${LIBRARY_NAME}-`),
							);
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
								const simpleOptions = typeof _pkgManager === "string";
								const pkgManager = simpleOptions
									? _pkgManager
									: _pkgManager.packageManager;
								const pkgManagerOptions = simpleOptions
									? undefined
									: _pkgManager.options;
								const runners = await createTestProject(
									{
										projectDir: process.cwd(),
										testProjectDir,
										debug,
										failFast,
									},
									{
										runBy: testConfigEntry.runWith,
										modType,
										pkgManager,
										pkgManagerOptions,
										testMatch: testConfigEntry.testMatch,
										typescript: testConfigEntry.transforms.typescript,
									},
								);
								return {
									runners,
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
			[] as Promise<{
				runners: TestRunner[];
				cleanup: () => Promise<void>;
			}>[],
		),
	);
	logger.logDebug(`Finished initializing test projects.`);

	const reporter = new SimpleReporter({
		debug,
	});

	// TODO: multi-threading pool for better results, although there's not a large amount of tests necessary at the moment
	try {
		for (const testRunnerPkg of testRunnerPkgs) {
			for (const runner of testRunnerPkg.runners) {
				const { failedFast } = await runner.runTests({
					timeout,
					testNames,
					reporter,
				});
				if (failedFast) {
					// Fail normally instead of letting an error make it to the top
					logger.log("Tests failed fast");
					throw new FailFastError("Tests failed fast");
				}
			}
		}
	} finally {
		// Cleanup async
		await Promise.allSettled(
			testRunnerPkgs.map(async ({ cleanup }) => {
				await cleanup();
			}),
		);
	}
}
