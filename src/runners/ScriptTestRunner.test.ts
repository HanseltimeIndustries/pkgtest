import { Reporter, TestGroupOverview } from "../reporters";
import { ScriptTestRunner } from "./ScriptTestRunner";
import { ModuleTypes, PkgManager } from "../types";
import { exec, ExecException } from "child_process";
import { ExecExit, ILogFilesScanner } from "../logging";
import { createTestProjectFolderPath } from "../files";

jest.mock("child_process");

const mockExec = jest.mocked(exec);
const mockReporter: Reporter = {
	start: jest.fn(),
	passed: jest.fn(),
	failed: jest.fn(),
	skipped: jest.fn(),
	summary: jest.fn(),
};

class MockExecException extends Error implements ExecException {
	cmd?: string | undefined;
	killed?: boolean | undefined;
	code?: number | undefined;
	signal?: NodeJS.Signals | undefined;
	stack?: string | undefined;

	constructor(opts: {
		message: string;
		cmd?: string;
		killed?: boolean;
		code?: number;
		signal?: NodeJS.Signals;
	}) {
		super(opts.message);
		this.cmd = opts.cmd;
		this.killed = opts.killed;
		this.code = opts.code;
		this.signal = opts.signal;
	}
}

const mockTopLevelLogFilesScanner: ILogFilesScanner = {
	scanOnly: jest.fn(),
	collectLogFiles: jest.fn(),
	createNested: jest.fn(),
};
const mockSuiteLogFilesScanner: ILogFilesScanner = {
	scanOnly: jest.fn(),
	collectLogFiles: jest.fn(),
	createNested: jest.fn(),
};
const mockPerTestLogFilesScanner: ILogFilesScanner = {
	scanOnly: jest.fn(),
	collectLogFiles: jest.fn(),
	createNested: jest.fn(),
};

const testProjectDir = "someDir";

const scriptTests = [
	{
		name: "s1",
		script: "echo 'something'",
	},
	{
		name: "s2",
		script: "echo 'another'",
	},
	{
		name: "s3",
		script: "echo 'numba3'",
	},
];
const testStdOutOnErr = "normal std out on err";
const testStdErr = "normal std err";
const testStdOutNormal = "normal std out";
const testEntryAlias = "entry1";

beforeEach(() => {
	jest.resetAllMocks();
	(mockTopLevelLogFilesScanner.createNested as jest.Mock).mockReturnValue(
		mockSuiteLogFilesScanner,
	);
	(mockSuiteLogFilesScanner.createNested as jest.Mock).mockReturnValue(
		mockPerTestLogFilesScanner,
	);
});

describe.each([[true], [false]])(
	"log file collection: %s",
	(shouldCollectLogFiles: boolean) => {
		const logFilesScanner = shouldCollectLogFiles
			? mockTopLevelLogFilesScanner
			: undefined;
		it("runs all script tests and reports the results", async () => {
			mockExec.mockImplementation((cmd, _opts, cb) => {
				if (!cb) {
					throw new Error("Did not expect an undefined callback!");
				}
				setTimeout(() => {
					if (cmd.includes(scriptTests[1].name)) {
						cb(
							new MockExecException({
								message: "failure",
							}),
							testStdOutOnErr,
							testStdErr,
						);
					} else {
						cb(null, testStdOutNormal, "");
					}
				}, 10);
				// Return null for now since we don't use the return process value
				return null as any;
			});
			const runner = new ScriptTestRunner({
				runCommand: "npm run",
				projectDir: testProjectDir,
				pkgManager: PkgManager.Npm,
				pkgManagerAlias: "myalias",
				modType: ModuleTypes.Commonjs,
				scriptTests,
				timeout: 5000,
				reporter: mockReporter,
				baseEnv: process.env,
				entryAlias: testEntryAlias,
			});

			const overview = await runner.runTests({
				logFilesScanner,
			});
			overviewEqual(overview, {
				passed: 2,
				failed: 1,
				skipped: 0,
				notReached: 0,
				total: 3,
				failedFast: false,
			});
			expect(overview.time).toBeGreaterThan(1);

			// Ensure the exec options match our expectation
			for (const { name } of scriptTests) {
				const cmd = `npm run ${name}`;
				expect(mockExec).toHaveBeenCalledWith(
					cmd,
					{
						cwd: testProjectDir,
						timeout: 5000,
						env: process.env,
					},
					expect.anything(),
				);
				if (cmd.includes(scriptTests[1].name)) {
					expect(mockReporter.failed).toHaveBeenCalledWith({
						testCmd: cmd,
						test: {
							name,
						},
						time: expect.any(Number),
						stdout: testStdOutOnErr,
						stderr: testStdErr,
						timedout: false,
					});
				} else {
					expect(mockReporter.passed).toHaveBeenCalledWith({
						testCmd: cmd,
						test: {
							name,
						},
						time: expect.any(Number),
						stdout: testStdOutNormal,
						stderr: "",
					});
				}
			}

			expect(mockReporter.start).toHaveBeenCalledWith(runner);
			expect(mockReporter.skipped).not.toHaveBeenCalled();
			expect(mockReporter.summary).toHaveBeenCalledWith(overview);
			if (shouldCollectLogFiles) {
				expect(mockTopLevelLogFilesScanner.createNested).toHaveBeenCalledWith(
					createTestProjectFolderPath(runner),
				);
				for (let i = 0; i < scriptTests.length; i++) {
					expect(mockSuiteLogFilesScanner.createNested).toHaveBeenCalledWith(
						`${i}`,
					);
				}
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledWith(
					testStdOutOnErr,
					testProjectDir,
					ExecExit.Error,
				);
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledWith(
					testStdErr,
					testProjectDir,
					ExecExit.Error,
				);
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledWith(
					testStdOutNormal,
					testProjectDir,
					ExecExit.Normal,
				);
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledTimes(6);
				expect(mockPerTestLogFilesScanner.collectLogFiles).toHaveBeenCalled();
			} else {
				expect(
					mockPerTestLogFilesScanner.collectLogFiles,
				).not.toHaveBeenCalled();
			}
		});

		it("runs test files until first failure and reports the results with failFast", async () => {
			mockExec.mockImplementation((cmd, _opts, cb) => {
				if (!cb) {
					throw new Error("Did not expect an undefined callback!");
				}
				setTimeout(() => {
					if (cmd.includes(scriptTests[1].name)) {
						cb(
							new MockExecException({
								message: "failure",
							}),
							testStdOutOnErr,
							testStdErr,
						);
					} else {
						cb(null, testStdOutNormal, "");
					}
				}, 10);
				// Return null for now since we don't use the return process value
				return null as any;
			});
			const runner = new ScriptTestRunner({
				runCommand: "npm run",
				projectDir: testProjectDir,
				pkgManager: PkgManager.Npm,
				pkgManagerAlias: "myalias",
				modType: ModuleTypes.Commonjs,
				scriptTests,
				failFast: true,
				timeout: 5000,
				reporter: mockReporter,
				baseEnv: process.env,
				entryAlias: testEntryAlias,
			});

			const overview = await runner.runTests({
				logFilesScanner,
			});
			overviewEqual(overview, {
				passed: 1,
				failed: 1,
				skipped: 0,
				notReached: 1,
				total: 3,
				failedFast: true,
			});
			expect(overview.time).toBeGreaterThan(1);

			// Ensure the exec options match our expectation
			let idx = 0;
			for (const { name } of scriptTests) {
				if (idx >= 2) {
					break;
				}
				const cmd = `npm run ${name}`;
				expect(mockExec).toHaveBeenCalledWith(
					cmd,
					{
						cwd: testProjectDir,
						timeout: 5000,
						env: process.env,
					},
					expect.anything(),
				);
				if (cmd.includes(scriptTests[1].name)) {
					expect(mockReporter.failed).toHaveBeenCalledWith({
						testCmd: cmd,
						test: {
							name,
						},
						time: expect.any(Number),
						stdout: testStdOutOnErr,
						stderr: testStdErr,
						timedout: false,
					});
				} else {
					expect(mockReporter.passed).toHaveBeenCalledWith({
						testCmd: cmd,
						test: {
							name,
						},
						time: expect.any(Number),
						stdout: testStdOutNormal,
						stderr: "",
					});
				}
				idx++;
			}

			expect(mockReporter.start).toHaveBeenCalledWith(runner);
			expect(mockReporter.passed).toHaveBeenCalledTimes(1);
			expect(mockReporter.failed).toHaveBeenCalledTimes(1);
			expect(mockReporter.skipped).not.toHaveBeenCalled();
			expect(mockReporter.summary).toHaveBeenCalledWith(overview);
			if (shouldCollectLogFiles) {
				expect(mockTopLevelLogFilesScanner.createNested).toHaveBeenCalledWith(
					createTestProjectFolderPath(runner),
				);
				for (let i = 0; i < scriptTests.length - 1; i++) {
					expect(mockSuiteLogFilesScanner.createNested).toHaveBeenCalledWith(
						`${i}`,
					);
				}
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledWith(
					testStdOutOnErr,
					testProjectDir,
					ExecExit.Error,
				);
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledWith(
					testStdErr,
					testProjectDir,
					ExecExit.Error,
				);
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledWith(
					testStdOutNormal,
					testProjectDir,
					ExecExit.Normal,
				);
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledTimes(4);
				expect(mockPerTestLogFilesScanner.collectLogFiles).toHaveBeenCalled();
			} else {
				expect(
					mockPerTestLogFilesScanner.collectLogFiles,
				).not.toHaveBeenCalled();
			}
		});
		it("runs test files and handles timeouts", async () => {
			mockExec.mockImplementation((cmd, _opts, cb) => {
				if (!cb) {
					throw new Error("Did not expect an undefined callback!");
				}
				if (cmd.includes(scriptTests[1].name)) {
					// Simulate a time out by waiting
					setTimeout(() => {
						cb(
							new MockExecException({
								message: "failure",
							}),
							testStdOutOnErr,
							testStdErr,
						);
					}, 60);
				} else {
					setTimeout(() => {
						cb(null, testStdOutNormal, "");
					}, 10);
				}
				// Return null for now since we don't use the return process value
				return null as any;
			});
			const runner = new ScriptTestRunner({
				runCommand: "npm run",
				projectDir: testProjectDir,
				pkgManager: PkgManager.Npm,
				pkgManagerAlias: "myalias",
				modType: ModuleTypes.Commonjs,
				scriptTests,
				failFast: false,
				timeout: 50,
				reporter: mockReporter,
				baseEnv: process.env,
				entryAlias: testEntryAlias,
			});

			const overview = await runner.runTests({
				logFilesScanner,
			});
			overviewEqual(overview, {
				passed: 2,
				failed: 1,
				skipped: 0,
				notReached: 0,
				total: 3,
				failedFast: false,
			});
			expect(overview.time).toBeGreaterThan(1);

			// Ensure the exec options match our expectation
			let idx = 0;
			for (const { name } of scriptTests) {
				if (idx >= 2) {
					break;
				}
				const cmd = `npm run ${name}`;
				expect(mockExec).toHaveBeenCalledWith(
					cmd,
					{
						cwd: testProjectDir,
						timeout: 50,
						env: process.env,
					},
					expect.anything(),
				);
				if (cmd.includes(scriptTests[1].name)) {
					expect(mockReporter.failed).toHaveBeenCalledWith({
						testCmd: cmd,
						test: {
							name,
						},
						time: expect.any(Number),
						stdout: testStdOutOnErr,
						stderr: testStdErr,
						timedout: true,
					});
				} else {
					expect(mockReporter.passed).toHaveBeenCalledWith({
						testCmd: cmd,
						test: {
							name,
						},
						time: expect.any(Number),
						stdout: testStdOutNormal,
						stderr: "",
					});
				}
				idx++;
			}

			expect(mockReporter.start).toHaveBeenCalledWith(runner);
			expect(mockReporter.passed).toHaveBeenCalledTimes(2);
			expect(mockReporter.failed).toHaveBeenCalledTimes(1);
			expect(mockReporter.skipped).not.toHaveBeenCalled();
			expect(mockReporter.summary).toHaveBeenCalledWith(overview);

			if (shouldCollectLogFiles) {
				expect(mockTopLevelLogFilesScanner.createNested).toHaveBeenCalledWith(
					createTestProjectFolderPath(runner),
				);
				for (let i = 0; i < scriptTests.length; i++) {
					expect(mockSuiteLogFilesScanner.createNested).toHaveBeenCalledWith(
						`${i}`,
					);
				}
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledWith(
					testStdOutOnErr,
					testProjectDir,
					ExecExit.Error,
				);
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledWith(
					testStdErr,
					testProjectDir,
					ExecExit.Error,
				);
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledWith(
					testStdOutNormal,
					testProjectDir,
					ExecExit.Normal,
				);
				expect(mockPerTestLogFilesScanner.scanOnly).toHaveBeenCalledTimes(6);
				expect(mockPerTestLogFilesScanner.collectLogFiles).toHaveBeenCalled();
			} else {
				expect(
					mockPerTestLogFilesScanner.collectLogFiles,
				).not.toHaveBeenCalled();
			}
		});

		function overviewEqual(
			overview: TestGroupOverview,
			eq: {
				passed: number;
				failed: number;
				skipped: number;
				notReached: number;
				total: number;
				failedFast: boolean;
			},
		) {
			const { passed, failed, skipped, notReached, total, failedFast } =
				overview;
			expect({
				passed,
				failed,
				skipped,
				notReached,
				total,
				failedFast,
			}).toEqual(eq);
		}
	},
);
