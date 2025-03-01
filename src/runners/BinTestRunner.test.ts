import { Reporter, TestGroupOverview } from "../reporters";
import { BinTestRunner } from "./BinTestRunner";
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

const testProjectDir = "someDir";
const testStdOutOnErr = "normal std out on err";
const testStdErr = "normal std err";
const testStdOutNormal = "normal std out";
const testEntryAlias = "entry1";
const testBaseCommand = (cmd: string) => `corepack npx ${cmd}`;

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
		it("runs all test bins and reports the results", async () => {
			mockExec.mockImplementation((cmd, _opts, cb) => {
				if (!cb) {
					throw new Error("Did not expect an undefined callback!");
				}
				setTimeout(() => {
					if (cmd.includes("bin2")) {
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
			const binTestConfig = {
				bin1: [
					{
						args: "--help",
					},
					{
						args: "someArg",
						env: {
							SPECIAL: "value",
						},
					},
				],
				bin2: [
					{
						args: "--help",
					},
				],
			};
			const runner = new BinTestRunner({
				runCommand: testBaseCommand,
				projectDir: testProjectDir,
				pkgManager: PkgManager.Npm,
				pkgManagerAlias: "myalias",
				modType: ModuleTypes.Commonjs,
				binTestConfig,
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
			for (const binCmd of Object.keys(binTestConfig)) {
				const configs = binTestConfig[binCmd as keyof typeof binTestConfig];
				for (const config of configs) {
					const cmd = testBaseCommand(`${binCmd} ${config.args}`);
					expect(mockExec).toHaveBeenCalledWith(
						testBaseCommand(`${binCmd} ${config.args}`),
						{
							cwd: testProjectDir,
							timeout: 5000,
							env: {
								...process.env,
								...((config as any).env ?? {}),
							},
						},
						expect.anything(),
					);
					if (cmd.includes("bin2")) {
						expect(mockReporter.failed).toHaveBeenCalledWith({
							testCmd: cmd,
							test: {
								bin: binCmd,
								...config,
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
								bin: binCmd,
								...config,
							},
							time: expect.any(Number),
							stdout: testStdOutNormal,
							stderr: "",
						});
					}
				}
			}

			expect(mockReporter.start).toHaveBeenCalledWith(runner);
			expect(mockReporter.skipped).not.toHaveBeenCalled();
			expect(mockReporter.summary).toHaveBeenCalledWith(overview);

			if (shouldCollectLogFiles) {
				expect(mockTopLevelLogFilesScanner.createNested).toHaveBeenCalledWith(
					createTestProjectFolderPath(runner),
				);
				Object.keys(binTestConfig).forEach((bin) => {
					const binArr = binTestConfig[
						bin as keyof typeof binTestConfig
					] as any[];
					for (let i = 0; i < binArr.length; i++) {
						expect(mockSuiteLogFilesScanner.createNested).toHaveBeenCalledWith(
							`${bin}${i}`,
						);
					}
				});
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
					if (cmd.includes("bin2")) {
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
			const binTestConfig = {
				bin1: [
					{
						args: "--help",
					},
				],
				bin2: [
					{
						args: "--help",
					},
					{
						args: "someArg",
						env: {
							SPECIAL: "value",
						},
					},
				],
			};
			const runner = new BinTestRunner({
				runCommand: testBaseCommand,
				projectDir: testProjectDir,
				pkgManager: PkgManager.Npm,
				pkgManagerAlias: "myalias",
				modType: ModuleTypes.Commonjs,
				binTestConfig,
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
			for (const binCmd of Object.keys(binTestConfig)) {
				const configs = binTestConfig[binCmd as keyof typeof binTestConfig];
				for (const config of configs) {
					// Skip the third one since it shoudl be skipped
					if (config.args === "someArg") {
						break;
					}
					const cmd = testBaseCommand(`${binCmd} ${config.args}`);
					expect(mockExec).toHaveBeenCalledWith(
						testBaseCommand(`${binCmd} ${config.args}`),
						{
							cwd: testProjectDir,
							timeout: 5000,
							env: {
								...process.env,
								...((config as any).env ?? {}),
							},
						},
						expect.anything(),
					);
					if (cmd.includes("bin2")) {
						expect(mockReporter.failed).toHaveBeenCalledWith({
							testCmd: cmd,
							test: {
								bin: binCmd,
								...config,
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
								bin: binCmd,
								...config,
							},
							time: expect.any(Number),
							stdout: testStdOutNormal,
							stderr: "",
						});
					}
				}
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
				Object.keys(binTestConfig).forEach((bin) => {
					// We don't do the bin1
					expect(mockSuiteLogFilesScanner.createNested).toHaveBeenCalledWith(
						`${bin}0`,
					);
				});

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
				if (cmd.includes("bin2")) {
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
			const binTestConfig = {
				bin1: [
					{
						args: "--help",
					},
				],
				bin2: [
					{
						args: "--help",
					},
				],
				bin3: [
					{
						args: "someArg",
						env: {
							SPECIAL: "value",
						},
					},
				],
			};
			const runner = new BinTestRunner({
				runCommand: testBaseCommand,
				projectDir: testProjectDir,
				pkgManager: PkgManager.Npm,
				pkgManagerAlias: "myalias",
				modType: ModuleTypes.Commonjs,
				binTestConfig,
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
			for (const binCmd of Object.keys(binTestConfig)) {
				const configs = binTestConfig[binCmd as keyof typeof binTestConfig];
				for (const config of configs) {
					// Skip the third one since it shoudl be skipped
					if (config.args === "someArg") {
						break;
					}
					const cmd = testBaseCommand(`${binCmd} ${config.args}`);
					expect(mockExec).toHaveBeenCalledWith(
						testBaseCommand(`${binCmd} ${config.args}`),
						{
							cwd: testProjectDir,
							timeout: 50,
							env: {
								...process.env,
								...((config as any).env ?? {}),
							},
						},
						expect.anything(),
					);
					if (cmd.includes("bin2")) {
						expect(mockReporter.failed).toHaveBeenCalledWith({
							testCmd: cmd,
							test: {
								bin: binCmd,
								...config,
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
								bin: binCmd,
								...config,
							},
							time: expect.any(Number),
							stdout: testStdOutNormal,
							stderr: "",
						});
					}
				}
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
				Object.keys(binTestConfig).forEach((bin) => {
					const binArr = binTestConfig[
						bin as keyof typeof binTestConfig
					] as any[];
					for (let i = 0; i < binArr.length; i++) {
						expect(mockSuiteLogFilesScanner.createNested).toHaveBeenCalledWith(
							`${bin}${i}`,
						);
					}
				});
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
		// TODO: bin test filters
		// it("runs only designated test files", async () => {
		// 	mockExec.mockImplementation((cmd, _opts, cb) => {
		// 		if (!cb) {
		// 			throw new Error("Did not expect an undefined callback!");
		// 		}
		// 		setTimeout(() => {
		// 			if (cmd.includes("test2")) {
		// 				cb(
		// 					new MockExecException({
		// 						message: "failure",
		// 					}),
		// 					testStdOutOnErr,
		// 					testStdErr,
		// 				);
		// 			} else {
		// 				cb(null, testStdOutNormal,, "");
		// 			}
		// 		}, 10);
		// 		// Return null for now since we don't use the return process value
		// 		return null as any;
		// 	});
		// 	const testFiles = [
		// 		{
		// 			orig: "something/test1.ts",
		// 			actual: "something/test1a.ts",
		// 		},
		// 		{
		// 			orig: "else/test2.js",
		// 			actual: "else/test2a.ts",
		// 		},
		// 		{
		// 			orig: "test3.ts",
		// 			actual: "test3a.ts",
		// 		},
		// 	];
		// 	const runner = new FileTestRunner({
		// 		runCommand: "npx",
		// 		runBy: RunWith.Node,
		// 		testFiles,
		// 		projectDir: testProjectDir,
		// 		pkgManager: PkgManager.Npm,
		// 		pkgManagerAlias: "myalias",
		// 		modType: ModuleTypes.Commonjs,
		// 		failFast: false,
		// 	});

		// 	const overview = await runner.runTests({
		// 		timeout: 1000,
		// 		testNames: ["**/*.ts"], // All tests
		// 		reporter: mockReporter,
		// 	});
		// 	overviewEqual(overview, {
		// 		passed: 2,
		// 		failed: 0,
		// 		skipped: 1,
		// 		notReached: [],
		// 		total: 3,
		// 		failedFast: false,
		// 	});
		// 	expect(overview.time).toBeGreaterThan(1);

		// 	// Ensure the exec options match our expectation
		// 	for (const testFile of testFiles.filter((tf) => tf.orig.endsWith(".ts"))) {
		// 		expect(mockExec).toHaveBeenCalledWith(
		// 			testBaseCommand(`${testFile.actual}`),
		// 			{
		// 				cwd: testProjectDir,
		// 				timeout: 1000,
		// 				env: process.env,
		// 			},
		// 			expect.anything(),
		// 		);
		// 	}

		// 	expect(mockReporter.start).toHaveBeenCalledWith(runner);
		// 	expect(mockReporter.passed).toHaveBeenCalledTimes(2);
		// 	expect(mockReporter.passed).toHaveBeenCalledWith({
		// 		testCmd: testBaseCommand(`something/test1a.ts`),
		// 		test: {
		// 			command: testBaseCommand(`something/test1a.ts`),
		// 			orig: "something/test1.ts",
		// 			actual: "something/test1a.ts",
		// 		},
		// 		time: expect.any(Number),
		// 		stdout: testStdOutOnErr,
		// 		stderr: "",
		// 	});
		// 	expect(mockReporter.passed).toHaveBeenCalledWith({
		// 		testCmd: testBaseCommand(`test3a.ts`),
		// 		test: {
		// 			command: testBaseCommand(`test3a.ts`),
		// 			orig: "test3.ts",
		// 			actual: "test3a.ts",
		// 		},
		// 		time: expect.any(Number),
		// 		stdout: testStdOutOnErr,
		// 		stderr: "",
		// 	});
		// 	expect(mockReporter.failed).not.toHaveBeenCalled();
		// 	expect(mockReporter.skipped).toHaveBeenCalledTimes(1);
		// 	expect(mockReporter.skipped).toHaveBeenCalledWith({
		// 		testCmd: testBaseCommand(`else/test2a.ts`),
		// 		test: {
		// 			command: testBaseCommand(`else/test2a.ts`),
		// 			orig: "else/test2.js",
		// 			actual: "else/test2a.ts",
		// 		},
		// 		time: 0,
		// 	});
		// 	expect(mockReporter.summary).toHaveBeenCalledWith(overview);
		// });
	},
);

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
	const { passed, failed, skipped, notReached, total, failedFast } = overview;
	expect({
		passed,
		failed,
		skipped,
		notReached,
		total,
		failedFast,
	}).toEqual(eq);
}
