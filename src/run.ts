import { tmpdir } from "os";
import { getConfig, LIBRARY_NAME } from "./config";
import { createTestProject } from "./createTestProject";
import { mkdtemp } from "fs/promises";
import { join } from "path";
import { TestRunner } from "./TestRunner";
import { SimpleReporter } from "./reporters/SimpleReporter";

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
	 * The max amount of time for a test to run (keep in mind, this is just the call to running the pkgTest script
	 * and not installation)
	 *
	 * Defaults to 2000
	 */
	timeout?: number;
	/**
	 * A filter of file names to run
	 */
	testNames?: string[];
}

export async function run(options: RunOptions) {
	const { debug, failFast, timeout = 2000, testNames = [] } = options;
	if (debug) {
		console.log("Retrieving Config...");
	}
	const config = await getConfig();

	if (debug) {
		console.log(JSON.stringify(config));
	}

	const tmpDir = process.env.PKG_TEST_TEMP_DIR ?? tmpdir();
	if (debug) {
		console.log(`Writing test projects to temporary directory: ${tmpDir}`);
	}

	// Set up the runner contexts
	if (debug) {
		console.log(`Initializing test projects...`);
	}
	const testRunnersDeep = await Promise.all(
		config.entries.reduce(
			(runners, testConfigEntry) => {
				testConfigEntry.moduleTypes.forEach((modType) => {
					runners.push(
						...testConfigEntry.packageManagers.map(async (pkgManager) => {
							const testProjectDir = await mkdtemp(
								join(tmpDir, `${LIBRARY_NAME}-`),
							);
							return await createTestProject(
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
									testMatch: testConfigEntry.testMatch,
									typescript: testConfigEntry.transforms.typescript,
								},
							);
						}),
					);
				});
				return runners;
			},
			[] as Promise<TestRunner[]>[],
		),
	);
	if (debug) {
		console.log(`Finished initializing test projects.`);
	}

	const reporter = new SimpleReporter({
		debug,
	});

	// TODO: multi-threading pool for better results, although there's not a large amount of tests necessary at the moment
	for (const runner of testRunnersDeep.flat()) {
		const { failedFast } = await runner.runTests({
			timeout,
			testNames,
			reporter,
		});
		if (failedFast) {
			// Fail normally instead of letting an error make it to the top
			console.log("Tests failed fast");
			process.exit(44);
		}
	}
}
