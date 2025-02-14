import { BinTestConfig, ModuleTypes, PkgManager } from "./types";
import { BinTest, BinTestRunnerDescribe, Reporter } from "./reporters";
import { BaseTestRunner } from "./BaseTestRunner";

export class BinTestRunner
	extends BaseTestRunner
	implements BinTestRunnerDescribe
{
	readonly runCommand: string;
	readonly binTestConfig: BinTestConfig;
	readonly pkgManager: PkgManager;
	/**
	 * An alias for the pkg manager configuration for this test suite.
	 *
	 * This is valuable for multiple of 'PkgManager' types (like yarn pnp and node-modules linking)
	 */
	readonly pkgManagerAlias: string;
	readonly modType: ModuleTypes;

	constructor(options: {
		runCommand: string;
		projectDir: string;
		binTestConfig: BinTestConfig;
		pkgManager: PkgManager;
		pkgManagerAlias: string;
		modType: ModuleTypes;
		failFast?: boolean;
		timeout: number;
		reporter: Reporter;
	}) {
		super(options);
		this.binTestConfig = options.binTestConfig;
		this.runCommand = options.runCommand;
		this.pkgManager = options.pkgManager;
		this.pkgManagerAlias = options.pkgManagerAlias;
		this.modType = options.modType;
	}

	// For now, we run this in parallel since we're running shell processes and that can lead to increased parallelism
	async runTests() {
		this.reporter.start(this);
		this.groupOverview.startTime();
		const binCmds = Object.keys(this.binTestConfig);
		const flatBinTests = binCmds.reduce((flat, binCmd) => {
			flat.push(
				...this.binTestConfig[binCmd].map((config) => {
					return {
						...config,
						bin: binCmd,
					};
				}),
			);
			return flat;
		}, [] as BinTest[]);
		this.groupOverview.addToTotal(flatBinTests.length);
		for (let i = 0; i < flatBinTests.length; i++) {
			const { args, env, bin } = flatBinTests[i];
			const command = `${this.runCommand} ${bin} ${args}`;
			const cont = await this.execTest(
				command,
				{
					bin,
					args,
					env,
				},
				{
					env: {
						...process.env,
						...env,
					},
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
