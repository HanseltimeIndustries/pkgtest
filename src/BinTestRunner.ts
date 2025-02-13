import { exec } from "child_process";
import { BinTestConfig, ModuleTypes, PkgManager } from "./types";
import { Reporter } from "./reporters";

export interface BinTest {
	bin: string;
	args: string;
	env?: Record<string, string>;
}

export interface BinTestRunnerDescribe {
	readonly pkgManager: PkgManager;
	readonly pkgManagerAlias: string;
	readonly modType: ModuleTypes;
	binTestConfig: BinTestConfig;
}

export class BinTestRunner implements BinTestRunnerDescribe {
	readonly runCommand: string;
	readonly binTestConfig: BinTestConfig;
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

	constructor(options: {
		runCommand: string;
		projectDir: string;
		binTestConfig: BinTestConfig;
		pkgManager: PkgManager;
		pkgManagerAlias: string;
		modType: ModuleTypes;
		failFast?: boolean;
	}) {
		this.binTestConfig = options.binTestConfig;
		this.runCommand = options.runCommand;
		this.projectDir = options.projectDir;
		this.pkgManager = options.pkgManager;
		this.pkgManagerAlias = options.pkgManagerAlias;
		this.modType = options.modType;
		this.failFast = !!options.failFast;
	}

	// For now, we run this in parallel since we're running shell processes and that can lead to increased parallelism
	async runTests(options: {
		/**
		 * The number of milliseconds a test should take
		 */
		timeout: number;
		/**
		 * How we will be reporting out each test that runs
		 */
		reporter: Reporter;
	}) {
		const { timeout, reporter } = options;
		const suiteStart = new Date().getTime();
		reporter.start(this);
		let passed = 0;
		let failed = 0;
		let skipped = 0;
		const notReached: BinTest[] = [];

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
		for (let i = 0; i < flatBinTests.length; i++) {
			const { args, env, bin } = flatBinTests[i];
			try {
				const cmd = `${this.runCommand} ${bin} ${args}`;
				const start = new Date();
				await new Promise<void>((res, rej) => {
					exec(
						cmd,
						{
							env: {
								...process.env,
								...env,
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
										bin,
										args,
										env,
									},
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
										bin,
										args,
										env,
									},
								});
							}

							// Always return unless we have failFast set
							res();
						},
					);
				});
			} catch (_e) {
				// Process the unready for the summary
				notReached.push(...flatBinTests.slice(i + 1));
				// if we throw an error here, then we are failing fast
				break;
			}
		}

		const summary = {
			passed,
			failed,
			skipped,
			notReached,
			total: flatBinTests.length,
			time: new Date().getTime() - suiteStart,
			failedFast: failed > 0 && this.failFast,
		};
		reporter.summary(summary);

		return summary;
	}
}
