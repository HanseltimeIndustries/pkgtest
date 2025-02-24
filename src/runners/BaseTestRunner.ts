import { exec } from "child_process";
import { TestGroupOverview, Reporter, TestDescriptor } from "../reporters";
import { FailFastError } from "../types";

export abstract class BaseTestRunner<RunTArgs> {
	readonly timeout: number;
	readonly projectDir: string;
	readonly groupOverview = new TestGroupOverview();
	readonly failFast: boolean;
	protected readonly reporter: Reporter;
	readonly baseEnv: {
		[e: string]: string | undefined;
	};

	constructor(options: {
		projectDir: string;
		failFast?: boolean;
		timeout: number;
		reporter: Reporter;
		baseEnv: {
			[e: string]: string | undefined;
		};
	}) {
		this.projectDir = options.projectDir;
		this.failFast = !!options.failFast;
		this.timeout = options.timeout;
		this.reporter = options.reporter;
		this.baseEnv = options.baseEnv;
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
				// if we throw an error here, then we are failing fast
				return false;
			} else {
				this.groupOverview.finalize();
				throw e;
			}
		}
		return true;
	}

	abstract runTests(opts: RunTArgs): Promise<TestGroupOverview>;
}
