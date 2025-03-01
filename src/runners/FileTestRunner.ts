import { ModuleTypes, PkgManager, RunWith } from "../types";
import micromatch from "micromatch";
import { FileTestRunnerDescribe, TestFile } from "../reporters";
import { BaseTestRunner, BaseTestRunnerOptions } from "./BaseTestRunner";
import { ILogFilesScanner } from "../logging";
import { createTestProjectFolderPath } from "../files";
import { join } from "path";
import camelCase from "lodash.camelcase";
import { BinRunCommand } from "../pkgManager";

interface RunTestOptions {
	/**
	 * If the array is non-empty, we only run tests that include the glob pattern provided
	 */
	testNames: string[];
	logFilesScanner?: ILogFilesScanner;
}

export interface FileTestRunnerOptions extends BaseTestRunnerOptions {
	/** This is a function that constructs the normal bin command surrounded by our package manager calls */
	baseCommand: BinRunCommand;
	/** the bin command */
	runCommand: string;
	runBy: RunWith;
	testFiles: TestFile[];
	pkgManager: PkgManager;
	pkgManagerAlias: string;
	modType: ModuleTypes;
	extraEnv?: {
		[env: string]: string;
	};
}

export class FileTestRunner
	extends BaseTestRunner<RunTestOptions>
	implements FileTestRunnerDescribe
{
	/** This is a function that constructs the normal bin command surrounded by our package manager calls */
	readonly baseCommand: BinRunCommand;
	readonly runCommand: string;
	readonly runBy: RunWith;
	readonly testFiles: TestFile[];
	readonly extraEnv: {
		[env: string]: string;
	};

	constructor(options: FileTestRunnerOptions) {
		super(options);
		this.runCommand = options.runCommand;
		this.runBy = options.runBy;
		this.testFiles = options.testFiles;
		this.extraEnv = options.extraEnv ?? {};
		this.baseCommand = options.baseCommand;
	}

	async runTests(options: RunTestOptions) {
		const { testNames } = options;
		this.reporter.start(this);
		this.groupOverview.startTime();
		this.groupOverview.addToTotal(this.testFiles.length);
		// Create a base nested collector base on this runner
		const projectLevelScanner = options.logFilesScanner?.createNested(
			join(createTestProjectFolderPath(this), this.runBy),
		);
		for (let i = 0; i < this.testFiles.length; i++) {
			const testFile = this.testFiles[i];
			const cmd = this.baseCommand(`${this.runCommand} ${testFile.actual}`);
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
				projectLevelScanner?.createNested(camelCase(testFile.orig)),
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
