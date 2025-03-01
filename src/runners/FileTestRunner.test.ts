import { Reporter, TestGroupOverview } from "../reporters";
import { FileTestRunner } from "./FileTestRunner";
import { ModuleTypes, PkgManager, RunWith } from "../types";
import { exec, ExecException } from "child_process";
import { ExecExit, ILogFilesScanner } from "../logging";
import { createTestProjectFolderPath } from "../files";
import { join } from "path";
import camelCase from "lodash.camelcase";

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
// The run command is loosley coupled to runWith but changes depending on context (i.e. ts-node in esm can't be called by ts-node)
const testRunCommand = "tsx";
const fakeBaseCommand = "corepacke npm@something";
const testBaseCommand = (cmd: string) => `${fakeBaseCommand} ${cmd}`;

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
		it("runs all test files and reports the results", async () => {
			mockExec.mockImplementation((cmd, _opts, cb) => {
				if (!cb) {
					throw new Error("Did not expect an undefined callback!");
				}
				setTimeout(() => {
					if (cmd.includes("test2")) {
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
			const testFiles = [
				{
					orig: "test1",
					actual: "test1a",
				},
				{
					orig: "test2",
					actual: "test2a",
				},
				{
					orig: "test3",
					actual: "test3a",
				},
			];
			const runner = new FileTestRunner({
				baseCommand: testBaseCommand,
				runCommand: testRunCommand,
				runBy: RunWith.Node,
				testFiles,
				projectDir: testProjectDir,
				pkgManager: PkgManager.Npm,
				pkgManagerAlias: "myalias",
				modType: ModuleTypes.Commonjs,
				timeout: 5000,
				reporter: mockReporter,
				baseEnv: process.env,
				entryAlias: testEntryAlias,
			});

			const overview = await runner.runTests({
				testNames: [], // All tests
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
			for (const testFile of testFiles) {
				expect(mockExec).toHaveBeenCalledWith(
					testBaseCommand(`${testRunCommand} ${testFile.actual}`),
					{
						cwd: testProjectDir,
						timeout: 5000,
						env: process.env,
					},
					expect.anything(),
				);
			}

			expect(mockReporter.start).toHaveBeenCalledWith(runner);
			expect(mockReporter.passed).toHaveBeenCalledWith({
				testCmd: testBaseCommand(`${testRunCommand} test1a`),
				test: {
					command: testBaseCommand(`${testRunCommand} test1a`),
					orig: "test1",
					actual: "test1a",
				},
				time: expect.any(Number),
				stdout: testStdOutNormal,
				stderr: "",
			});
			expect(mockReporter.failed).toHaveBeenCalledWith({
				testCmd: testBaseCommand(`${testRunCommand} test2a`),
				test: {
					command: testBaseCommand(`${testRunCommand} test2a`),
					orig: "test2",
					actual: "test2a",
				},
				time: expect.any(Number),
				stdout: testStdOutOnErr,
				stderr: testStdErr,
				timedout: false,
			});
			expect(mockReporter.passed).toHaveBeenCalledWith({
				testCmd: testBaseCommand(`${testRunCommand} test3a`),
				test: {
					command: testBaseCommand(`${testRunCommand} test3a`),
					orig: "test3",
					actual: "test3a",
				},
				time: expect.any(Number),
				stdout: testStdOutNormal,
				stderr: "",
			});
			expect(mockReporter.skipped).not.toHaveBeenCalled();
			expect(mockReporter.summary).toHaveBeenCalledWith(overview);

			if (shouldCollectLogFiles) {
				expect(mockTopLevelLogFilesScanner.createNested).toHaveBeenCalledWith(
					join(createTestProjectFolderPath(runner), runner.runBy),
				);
				for (const { orig } of testFiles) {
					expect(mockSuiteLogFilesScanner.createNested).toHaveBeenCalledWith(
						orig,
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
					if (cmd.includes("test2")) {
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
			const testFiles = [
				{
					orig: "test1",
					actual: "test1a",
				},
				{
					orig: "test2",
					actual: "test2a",
				},
				{
					orig: "test3",
					actual: "test3a",
				},
			];
			const runner = new FileTestRunner({
				baseCommand: testBaseCommand,
				runCommand: testRunCommand,
				runBy: RunWith.Node,
				testFiles,
				projectDir: testProjectDir,
				pkgManager: PkgManager.Npm,
				pkgManagerAlias: "myalias",
				modType: ModuleTypes.Commonjs,
				failFast: true,
				timeout: 5000,
				reporter: mockReporter,
				baseEnv: process.env,
				entryAlias: testEntryAlias,
			});

			const overview = await runner.runTests({
				testNames: [], // All tests
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
			for (const testFile of testFiles.slice(0, 2)) {
				expect(mockExec).toHaveBeenCalledWith(
					testBaseCommand(`${testRunCommand} ${testFile.actual}`),
					{
						cwd: testProjectDir,
						timeout: 5000,
						env: process.env,
					},
					expect.anything(),
				);
			}

			expect(mockReporter.start).toHaveBeenCalledWith(runner);
			expect(mockReporter.passed).toHaveBeenCalledTimes(1);
			expect(mockReporter.passed).toHaveBeenCalledWith({
				testCmd: testBaseCommand(`${testRunCommand} test1a`),
				test: {
					command: testBaseCommand(`${testRunCommand} test1a`),
					orig: "test1",
					actual: "test1a",
				},
				time: expect.any(Number),
				stdout: testStdOutNormal,
				stderr: "",
			});
			expect(mockReporter.failed).toHaveBeenCalledTimes(1);
			expect(mockReporter.failed).toHaveBeenCalledWith({
				testCmd: testBaseCommand(`${testRunCommand} test2a`),
				test: {
					command: testBaseCommand(`${testRunCommand} test2a`),
					orig: "test2",
					actual: "test2a",
				},
				time: expect.any(Number),
				stdout: testStdOutOnErr,
				stderr: testStdErr,
				timedout: false,
			});
			expect(mockReporter.skipped).not.toHaveBeenCalled();
			expect(mockReporter.summary).toHaveBeenCalledWith(overview);

			if (shouldCollectLogFiles) {
				expect(mockTopLevelLogFilesScanner.createNested).toHaveBeenCalledWith(
					join(createTestProjectFolderPath(runner), runner.runBy),
				);
				for (const { orig } of testFiles.slice(0, 2)) {
					expect(mockSuiteLogFilesScanner.createNested).toHaveBeenCalledWith(
						orig,
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
				if (cmd.includes("test2")) {
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
			const testFiles = [
				{
					orig: "test1",
					actual: "test1a",
				},
				{
					orig: "test2",
					actual: "test2a",
				},
				{
					orig: "test3",
					actual: "test3a",
				},
			];
			const runner = new FileTestRunner({
				baseCommand: testBaseCommand,
				runCommand: testRunCommand,
				runBy: RunWith.Node,
				testFiles,
				projectDir: testProjectDir,
				pkgManager: PkgManager.Npm,
				pkgManagerAlias: "myalias",
				modType: ModuleTypes.Commonjs,
				failFast: false,
				timeout: 50,
				reporter: mockReporter,
				baseEnv: process.env,
				entryAlias: testEntryAlias,
			});

			const overview = await runner.runTests({
				testNames: [], // All tests
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
			for (const testFile of testFiles) {
				expect(mockExec).toHaveBeenCalledWith(
					testBaseCommand(`${testRunCommand} ${testFile.actual}`),
					{
						cwd: testProjectDir,
						timeout: 50,
						env: process.env,
					},
					expect.anything(),
				);
			}

			expect(mockReporter.start).toHaveBeenCalledWith(runner);
			expect(mockReporter.passed).toHaveBeenCalledTimes(2);
			expect(mockReporter.passed).toHaveBeenCalledWith({
				testCmd: testBaseCommand(`${testRunCommand} test1a`),
				test: {
					command: testBaseCommand(`${testRunCommand} test1a`),
					orig: "test1",
					actual: "test1a",
				},
				time: expect.any(Number),
				stdout: testStdOutNormal,
				stderr: "",
			});
			expect(mockReporter.passed).toHaveBeenCalledWith({
				testCmd: testBaseCommand(`${testRunCommand} test3a`),
				test: {
					command: testBaseCommand(`${testRunCommand} test3a`),
					orig: "test3",
					actual: "test3a",
				},
				time: expect.any(Number),
				stdout: testStdOutNormal,
				stderr: "",
			});
			expect(mockReporter.failed).toHaveBeenCalledTimes(1);
			expect(mockReporter.failed).toHaveBeenCalledWith({
				testCmd: testBaseCommand(`${testRunCommand} test2a`),
				test: {
					command: testBaseCommand(`${testRunCommand} test2a`),
					orig: "test2",
					actual: "test2a",
				},
				time: expect.any(Number),
				stdout: testStdOutOnErr,
				stderr: testStdErr,
				timedout: true,
			});
			expect(mockReporter.skipped).not.toHaveBeenCalled();
			expect(mockReporter.summary).toHaveBeenCalledWith(overview);

			if (shouldCollectLogFiles) {
				expect(mockTopLevelLogFilesScanner.createNested).toHaveBeenCalledWith(
					join(createTestProjectFolderPath(runner), runner.runBy),
				);
				for (const { orig } of testFiles) {
					expect(mockSuiteLogFilesScanner.createNested).toHaveBeenCalledWith(
						orig,
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
		it("runs only designated test files", async () => {
			mockExec.mockImplementation((cmd, _opts, cb) => {
				if (!cb) {
					throw new Error("Did not expect an undefined callback!");
				}
				setTimeout(() => {
					if (cmd.includes("test2")) {
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
			const testFiles = [
				{
					orig: "something/test1.ts",
					actual: "something/test1a.ts",
				},
				{
					orig: "else/test2.js",
					actual: "else/test2a.ts",
				},
				{
					orig: "test3.ts",
					actual: "test3a.ts",
				},
			];
			const runner = new FileTestRunner({
				baseCommand: testBaseCommand,
				runCommand: testRunCommand,
				runBy: RunWith.Node,
				testFiles,
				projectDir: testProjectDir,
				pkgManager: PkgManager.Npm,
				pkgManagerAlias: "myalias",
				modType: ModuleTypes.Commonjs,
				failFast: false,
				timeout: 1000,
				reporter: mockReporter,
				baseEnv: process.env,
				entryAlias: testEntryAlias,
			});

			const overview = await runner.runTests({
				testNames: ["**/*.ts"], // All tests
				logFilesScanner,
			});
			overviewEqual(overview, {
				passed: 2,
				failed: 0,
				skipped: 1,
				notReached: 0,
				total: 3,
				failedFast: false,
			});
			expect(overview.time).toBeGreaterThan(1);

			// Ensure the exec options match our expectation
			for (const testFile of testFiles.filter((tf) =>
				tf.orig.endsWith(".ts"),
			)) {
				expect(mockExec).toHaveBeenCalledWith(
					testBaseCommand(`${testRunCommand} ${testFile.actual}`),
					{
						cwd: testProjectDir,
						timeout: 1000,
						env: process.env,
					},
					expect.anything(),
				);
			}

			expect(mockReporter.start).toHaveBeenCalledWith(runner);
			expect(mockReporter.passed).toHaveBeenCalledTimes(2);
			expect(mockReporter.passed).toHaveBeenCalledWith({
				testCmd: testBaseCommand(`${testRunCommand} something/test1a.ts`),
				test: {
					command: testBaseCommand(`${testRunCommand} something/test1a.ts`),
					orig: "something/test1.ts",
					actual: "something/test1a.ts",
				},
				time: expect.any(Number),
				stdout: testStdOutNormal,
				stderr: "",
			});
			expect(mockReporter.passed).toHaveBeenCalledWith({
				testCmd: testBaseCommand(`${testRunCommand} test3a.ts`),
				test: {
					command: testBaseCommand(`${testRunCommand} test3a.ts`),
					orig: "test3.ts",
					actual: "test3a.ts",
				},
				time: expect.any(Number),
				stdout: testStdOutNormal,
				stderr: "",
			});
			expect(mockReporter.failed).not.toHaveBeenCalled();
			expect(mockReporter.skipped).toHaveBeenCalledTimes(1);
			expect(mockReporter.skipped).toHaveBeenCalledWith({
				testCmd: testBaseCommand(`${testRunCommand} else/test2a.ts`),
				test: {
					command: testBaseCommand(`${testRunCommand} else/test2a.ts`),
					orig: "else/test2.js",
					actual: "else/test2a.ts",
				},
				time: 0,
			});
			expect(mockReporter.summary).toHaveBeenCalledWith(overview);

			if (shouldCollectLogFiles) {
				expect(mockTopLevelLogFilesScanner.createNested).toHaveBeenCalledWith(
					join(createTestProjectFolderPath(runner), runner.runBy),
				);
				for (const orig of ["test3.ts", "something/test1.ts"]) {
					expect(mockSuiteLogFilesScanner.createNested).toHaveBeenCalledWith(
						camelCase(orig),
					);
				}
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
