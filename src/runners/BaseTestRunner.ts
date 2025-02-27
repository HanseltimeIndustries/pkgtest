import { exec } from "child_process";
import { TestGroupOverview, Reporter, TestDescriptor } from "../reporters";
import { FailFastError, ModuleTypes, PkgManager } from "../types";
import { ExecExit, ILogFilesScanner } from "../logging";

export interface BaseTestRunnerOptions {
	projectDir: string;
	failFast?: boolean;
	timeout: number;
	reporter: Reporter;
	baseEnv: {
		[e: string]: string | undefined;
	};
	pkgManager: PkgManager;
	pkgManagerAlias: string;
	modType: ModuleTypes;
	entryAlias: string;
}

export abstract class BaseTestRunner<RunTArgs> {
	readonly timeout: number;
	readonly projectDir: string;
	readonly groupOverview = new TestGroupOverview();
	readonly failFast: boolean;
	protected readonly reporter: Reporter;
	readonly pkgManager: PkgManager;
	/**
	 * An alias for the pkg manager configuration for this test suite.
	 *
	 * This is valuable for multiple of 'PkgManager' types (like yarn pnp and node-modules linking)
	 */
	readonly pkgManagerAlias: string;
	readonly modType: ModuleTypes;
	readonly entryAlias: string;
	readonly baseEnv: {
		[e: string]: string | undefined;
	};

	constructor(options: BaseTestRunnerOptions) {
		this.projectDir = options.projectDir;
		this.failFast = !!options.failFast;
		this.timeout = options.timeout;
		this.reporter = options.reporter;
		this.baseEnv = options.baseEnv;
		this.pkgManager = options.pkgManager;
		this.pkgManagerAlias = options.pkgManagerAlias;
		this.modType = options.modType;
		this.entryAlias = options.entryAlias;
	}

	/**
	 * Used to abstract away some of test execution for a single bin command
	 * @param test
	 * @param opts
	 * @returns boolean - if it should continue or not
	 */
	protected async execTest(
		binCmd: string,
		testDescriptor: TestDescriptor,
		opts: {
			env: {
				[k: string]: string | undefined;
			};
		},
		logFilesScanner?: ILogFilesScanner,
	): Promise<boolean> {
		try {
			const start = new Date();
			await new Promise<void>((res, rej) => {
				exec(
					binCmd,
					{
						env: {
							...this.baseEnv,
							...opts.env,
						},
						cwd: this.projectDir,
						timeout: this.timeout,
					},
					(err, stdout, stderr) => {
						const testTimeMs = new Date().getTime() - start.getTime();
						if (err) {
							this.groupOverview.fail(1);
							this.reporter.failed({
								testCmd: binCmd,
								time: testTimeMs,
								stdout,
								stderr,
								timedout: testTimeMs >= this.timeout,
								test: testDescriptor,
							});
							logFilesScanner?.scanOnly(
								stdout,
								this.projectDir,
								ExecExit.Error,
							);
							logFilesScanner?.scanOnly(
								stderr,
								this.projectDir,
								ExecExit.Error,
							);
							if (this.failFast) {
								rej(new FailFastError());
							}
						} else {
							this.groupOverview.pass(1);
							this.reporter.passed({
								testCmd: binCmd,
								time: testTimeMs,
								stdout,
								stderr,
								test: testDescriptor,
							});
							logFilesScanner?.scanOnly(
								stdout,
								this.projectDir,
								ExecExit.Normal,
							);
							logFilesScanner?.scanOnly(
								stderr,
								this.projectDir,
								ExecExit.Normal,
							);
						}

						// Always return unless we have failFast set
						res();
					},
				);
			});
		} catch (e) {
			// Process the unready for the summary
			if (e instanceof FailFastError) {
				this.groupOverview.finalize(true);
				return false;
			} else {
				this.groupOverview.finalize();
				throw e;
			}
		} finally {
			logFilesScanner?.collectLogFiles();
		}
		return true;
	}

	abstract runTests(
		opts: RunTArgs & {
			logFilesScanner?: ILogFilesScanner;
		},
	): Promise<TestGroupOverview>;
}
