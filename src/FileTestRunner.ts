import { ModuleTypes, PkgManager, RunWith } from "./types";
import micromatch from "micromatch";
import { FileTestRunnerDescribe, Reporter, TestFile } from "./reporters";
import { BaseTestRunner } from "./BaseTestRunner";

export class FileTestRunner
	extends BaseTestRunner
	implements FileTestRunnerDescribe
{
	readonly runCommand: string;
	readonly runBy: RunWith;
	readonly testFiles: TestFile[];
	readonly pkgManager: PkgManager;
	/**
	 * An alias for the pkg manager configuration for this test suite.
	 *
	 * This is valuable for multiple of 'PkgManager' types (like yarn pnp and node-modules linking)
	 */
	readonly pkgManagerAlias: string;
	readonly modType: ModuleTypes;
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
		baseEnv: {
			[e: string]: string | undefined;
		},
		extraEnv?: {
			[env: string]: string;
		};
		failFast?: boolean;
		timeout: number;
		reporter: Reporter;
	}) {
		super(options);
		this.runCommand = options.runCommand;
		this.runBy = options.runBy;
		this.testFiles = options.testFiles;
		this.pkgManager = options.pkgManager;
		this.pkgManagerAlias = options.pkgManagerAlias;
		this.modType = options.modType;
		this.extraEnv = options.extraEnv ?? {};
	}

	// For now, we run this in parallel since we're running shell processes and that can lead to increased parallelism
	async runTests(options: {
		/**
		 * If the array is non-empty, we only run tests that include the glob pattern provided
		 */
		testNames: string[];
	}) {
		const { testNames } = options;
		this.reporter.start(this);
		this.groupOverview.startTime();
		this.groupOverview.addToTotal(this.testFiles.length);
		for (let i = 0; i < this.testFiles.length; i++) {
			const testFile = this.testFiles[i];
			const cmd = `${this.runCommand} ${testFile.actual}`;
			if (testNames.length > 0) {
				if (!micromatch.isMatch(testFile.orig, testNames)) {
					this.groupOverview.skip(1);
					this.reporter.skipped({
						testCmd: cmd,
						time: 0,
						test: {
							...testFile,
							command: cmd,
						},
					});
					continue;
				}
			}
			const cont = await this.execTest(
				cmd,
				{
					...testFile,
					command: cmd,
				},
				{
					env: this.extraEnv,
				},
			);
			if (!cont) {
				break;
			}
		}

		this.groupOverview.finalize();
		this.reporter.summary(this.groupOverview);

		return this.groupOverview;
	}
}
