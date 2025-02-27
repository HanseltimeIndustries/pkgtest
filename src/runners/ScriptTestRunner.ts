import { ScriptTestConfig } from "../types";
import { ScriptTestRunnerDescribe } from "../reporters";
import { BaseTestRunner, BaseTestRunnerOptions } from "./BaseTestRunner";
import { ILogFilesScanner } from "../logging";
import { createTestProjectFolderPath } from "../files";

export interface ScriptTestRunnerOptions extends BaseTestRunnerOptions {
	runCommand: string;
	scriptTests: ScriptTestConfig[];
}

export class ScriptTestRunner
	extends BaseTestRunner<undefined>
	implements ScriptTestRunnerDescribe
{
	readonly runCommand: string;
	readonly scriptTests: ScriptTestConfig[];

	constructor(options: ScriptTestRunnerOptions) {
		super(options);
		this.scriptTests = options.scriptTests;
		this.runCommand = options.runCommand;
	}

	async runTests(options: {
		logFilesScanner?: ILogFilesScanner;
	}) {
		this.reporter.start(this);
		this.groupOverview.startTime();
		this.groupOverview.addToTotal(this.scriptTests.length);
		const testLevelScanner = options.logFilesScanner?.createNested(
			createTestProjectFolderPath(this),
		);
		for (let i = 0; i < this.scriptTests.length; i++) {
			const { name } = this.scriptTests[i];
			const command = `${this.runCommand} ${name}`;
			const cont = await this.execTest(
				command,
				{
					name,
				},
				{
					// No additional env
					env: {},
				},
				testLevelScanner?.createNested(`${i}`),
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
