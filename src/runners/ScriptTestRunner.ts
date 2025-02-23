import { ModuleTypes, PkgManager, ScriptTestConfig } from "../types";
import { ScriptTestRunnerDescribe, Reporter } from "../reporters";
import { BaseTestRunner } from "./BaseTestRunner";

export class ScriptTestRunner
	extends BaseTestRunner<undefined>
	implements ScriptTestRunnerDescribe
{
	readonly runCommand: string;
	readonly scriptTests: ScriptTestConfig[];
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
		scriptTests: ScriptTestConfig[];
		pkgManager: PkgManager;
		pkgManagerAlias: string;
		modType: ModuleTypes;
		failFast?: boolean;
		timeout: number;
		reporter: Reporter;
		baseEnv: {
			[e: string]: string | undefined;
		};
	}) {
		super(options);
		this.scriptTests = options.scriptTests;
		this.runCommand = options.runCommand;
		this.pkgManager = options.pkgManager;
		this.pkgManagerAlias = options.pkgManagerAlias;
		this.modType = options.modType;
	}

	async runTests() {
		this.reporter.start(this);
		this.groupOverview.startTime();
		this.groupOverview.addToTotal(this.scriptTests.length);
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
