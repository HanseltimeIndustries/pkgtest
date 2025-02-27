import { BinTestConfig, ModuleTypes, PkgManager } from "../types";
import { BinTest, BinTestRunnerDescribe } from "../reporters";
import { BaseTestRunner, BaseTestRunnerOptions } from "./BaseTestRunner";
import { ILogFilesScanner } from "../logging";
import { createTestProjectFolderPath } from "../files";

export interface BinTestRunnerOptions extends BaseTestRunnerOptions {
	runCommand: string;
	binTestConfig: BinTestConfig;
	pkgManager: PkgManager;
	pkgManagerAlias: string;
	modType: ModuleTypes;
}

export class BinTestRunner
	extends BaseTestRunner<undefined>
	implements BinTestRunnerDescribe
{
	readonly runCommand: string;
	readonly binTestConfig: BinTestConfig;

	constructor(options: BinTestRunnerOptions) {
		super(options);
		this.binTestConfig = options.binTestConfig;
		this.runCommand = options.runCommand;
	}

	async runTests(options: {
		logFilesScanner?: ILogFilesScanner;
	}) {
		this.reporter.start(this);
		this.groupOverview.startTime();
		const testLevelScanner = options.logFilesScanner?.createNested(
			createTestProjectFolderPath(this),
		);
		const binCmds = Object.keys(this.binTestConfig);
		const flatBinTests = binCmds.reduce(
			(flat, binCmd) => {
				flat.push(
					...this.binTestConfig[binCmd].map((config, index) => {
						return {
							...config,
							bin: binCmd,
							bindex: index,
						};
					}),
				);
				return flat;
			},
			[] as (BinTest & { bindex: number })[],
		);
		this.groupOverview.addToTotal(flatBinTests.length);
		for (let i = 0; i < flatBinTests.length; i++) {
			const { args, env, bin, bindex } = flatBinTests[i];
			const command = `${this.runCommand} ${bin} ${args}`;
			const cont = await this.execTest(
				command,
				{
					bin,
					args,
					env,
				},
				{
					env: env ?? {},
				},
				testLevelScanner?.createNested(`${bin}${bindex}`),
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
