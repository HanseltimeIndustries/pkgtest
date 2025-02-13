import { exec } from "child_process";
import { ModuleTypes, PkgManager, RunWith } from "./types";
import micromatch from "micromatch";
import { Reporter } from "./reporters";

export interface TestFile {
		/** The original file name - i.e. the file that was copied, relative to the cwd of the framework */
		orig: string;
		/** The actual testFile that we want to run (i.e. copied or compiled) */
		actual: string;
}

export interface FileTest extends TestFile {
	/**
	 * The actual command run - this is in effect the true test
	 */
	command: string;
}

export class FileTestRunner {
	readonly runCommand: string;
	readonly runBy: RunWith;
	readonly testFiles: TestFile[];
	readonly projectDir: string;
	readonly pkgManager: PkgManager;
	/**
	 * An alias for the pkg manager configuration for this test suite.
	 *
	 * This is valuable for multiple of 'PkgManager' types (like yarn pnp and node-modules linking)
	 */
	readonly pkgManagerAlias: string;
	readonly modType: ModuleTypes;
	readonly failFast: boolean;
	readonly extraEnv: {
		[env: string]: string;
	};

	constructor(options: {
		runCommand: string;
		runBy: RunWith;
		testFiles: TestFile[];
		projectDir: string;
		pkgManager: PkgManager;
		pkgManagerAlias: string;
		modType: ModuleTypes;
		extraEnv?: {
			[env: string]: string;
		};
		failFast?: boolean;
	}) {
		this.runCommand = options.runCommand;
		this.runBy = options.runBy;
		this.testFiles = options.testFiles;
		this.projectDir = options.projectDir;
		this.pkgManager = options.pkgManager;
		this.pkgManagerAlias = options.pkgManagerAlias;
		this.modType = options.modType;
		this.failFast = !!options.failFast;
		this.extraEnv = options.extraEnv ?? {};
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
		/**
		 * How we will be reporting out each test that runs
		 */
		reporter: Reporter;
	}) {
		const { timeout, testNames, reporter } = options;
		const suiteStart = new Date().getTime();
		reporter.start(this);
		let passed = 0;
		let failed = 0;
		let skipped = 0;
		const notReached: TestFile[] = [];

		for (let i = 0; i < this.testFiles.length; i++) {
			const testFile = this.testFiles[i];
			try {
				const cmd = `${this.runCommand} ${testFile.actual}`;
				const start = new Date();
				if (testNames.length > 0) {
					if (!micromatch.isMatch(testFile.orig, testNames)) {
						skipped++;
						reporter.skipped({
							testCmd: cmd,
							time: 0,
							test: {
								...testFile,
								command: cmd,
							}
						});
						continue;
					}
				}
				await new Promise<void>((res, rej) => {
					exec(
						cmd,
						{
							env: {
								...process.env,
								...this.extraEnv,
							},
							cwd: this.projectDir,
							timeout,
						},
						(err, stdout, stderr) => {
							const testTimeMs = new Date().getTime() - start.getTime();
							if (err) {
								failed++;
								reporter.failed({
									testCmd: cmd,
									time: testTimeMs,
									stdout,
									stderr,
									timedout: testTimeMs >= timeout,
									test: {
										...testFile,
										command: cmd,
									}
								});
								if (this.failFast) {
									rej();
								}
							} else {
								passed++;
								reporter.passed({
									testCmd: cmd,
									time: testTimeMs,
									stdout,
									stderr,
									test: {
										...testFile,
										command: cmd,
									}
								});
							}

							// Always return unless we have failFast set
							res();
						},
					);
				});
			} catch (_e) {
				// Process the unready for the summary
				notReached.push(...this.testFiles.slice(i + 1));
				// if we throw an error here, then we are failing fast
				break;
			}
		}

		const summary = {
			passed,
			failed,
			skipped,
			notReached,
			total: this.testFiles.length,
			time: new Date().getTime() - suiteStart,
			failedFast: failed > 0 && this.failFast,
		};
		reporter.summary(summary);

		return summary;
	}
}
