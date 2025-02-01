import { exec } from "child_process";
import { ModuleTypes, PkgManager, RunBy } from "./types";
import chalk from "chalk";
import micromatch from "micromatch";

export class FailFastError extends Error {}

export class TestRunner {
	readonly binRunCommand: string;
	readonly runBy: RunBy;
	readonly testFiles: string[];
	readonly projectDir: string;
	readonly pkgManager: PkgManager;
	readonly modType: ModuleTypes;
	readonly debug?: boolean;
	readonly failFast?: boolean;

	constructor(options: {
		binRunCommand: string;
		runBy: RunBy;
		testFiles: string[];
		projectDir: string;
		pkgManager: PkgManager;
		modType: ModuleTypes;
		debug?: boolean;
		failFast?: boolean;
	}) {
        this.binRunCommand = options.binRunCommand
        this.runBy = options.runBy
        this.testFiles = options.testFiles
        this.projectDir = options.projectDir
        this.pkgManager = options.pkgManager
        this.modType = options.modType
	}

	// For now, we run this in parallel since we're running shell processes and that can lead to increased parallelism
	async runTests(options: {
		/**
		 * The number of milliseconds a test should take
		 */
		timeout: number;
		/**
		 * If the array is non-empty, we only run tests that include the glob pattern provided
		 */
		testNames: string[];
	}) {
		const { timeout, testNames } = options;
		console.log(
			`Test Suite for Module ${this.modType}, Package Manager ${this.pkgManager}, Run with ${this.runBy}`,
		);
		console.log(`Test package location: ${this.projectDir}`);

		const passed: {
			cmd: string;
			timeMs: number;
		}[] = [];
		const failed: {
			cmd: string;
			timeMs: number;
			timedOut: boolean;
		}[] = [];

		for (const testFile of this.testFiles) {
			try {
				const cmd = `${this.binRunCommand} ${this.runBy} ${testFile}`;
				const start = new Date();
				console.log(`${chalk.blue("Test: ")} ${cmd}:`);
				if (testNames.length > 0) {
					if (
						!micromatch.isMatch(
							testFile.replace(this.projectDir, ""),
							testNames,
						)
					) {
						console.log(chalk.yellow("Skipped"));
						// Continue so we skip it
						continue;
					}
				}
				await new Promise<void>((res, rej) => {
					exec(
						cmd,
						{
							env: process.env,
							cwd: this.projectDir,
							timeout,
						},
						(err, stdout, stderr) => {
							const testTimeMs = new Date().getTime() - start.getTime();
							if (!err) {
								if (testTimeMs >= timeout) {
									console.error(
										`${chalk.red("Test exceeded timeout")}: ${timeout} ms`,
									);
								}
								console.error(stderr);
								failed.push({
									cmd,
									timeMs: testTimeMs,
									timedOut: testTimeMs >= timeout,
								});
								if (this.failFast) {
									rej();
								}
							} else {
								if (this.debug) {
									console.log(stdout);
								}
								passed.push({
									cmd,
									timeMs: testTimeMs,
								});
							}
							// Always return unless we have failFast set
							res();
						},
					);
				});
			} catch (_e) {
				// if we throw an error here, then we are failing fast
				break;
			}
		}

		// Apply summary
		passed.forEach(({ cmd, timeMs }) => {
			console.log(testResultLine(cmd, timeMs, true));
		});
		failed.forEach(({ cmd, timeMs }) => {
			console.log(testResultLine(cmd, timeMs, false));
		});
		// Use this metric in the event that fail fast occurs
		const skipped = this.testFiles.length - passed.length - failed.length;
		console.log(
			`Passed: ${chalk.green(passed.length)}\nFailed: ${chalk.red(failed.length)}\nSkipped: ${skipped === 0 ? skipped : chalk.yellow(skipped)}\nTotal: ${this.testFiles.length}`,
		);

		if (failed.length > 0 && this.failFast) {
			throw new FailFastError(`A test failed!`);
		}
	}
}

function testResultLine(cmd: string, testTimeMs: number, passed: boolean) {
	`${passed ? chalk.green("PASSED") : chalk.red("FAILED")} ${cmd}   ${chalk.gray(`${testTimeMs} ms`)}`;
}
