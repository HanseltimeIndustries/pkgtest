import { Reporter } from "./reporters";
import { TestRunner } from "./TestRunner";
import { ModuleTypes, PkgManager, RunBy } from "./types";
import { exec, ExecException } from "child_process";

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

const testProjectDir = "someDir";

beforeEach(() => {
	jest.resetAllMocks();
});

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
					"normal std processes",
					"whoa dang!",
				);
			} else {
				cb(null, "normal std processes", "");
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
	const runner = new TestRunner({
		runCommand: "npx",
		runBy: RunBy.Node,
		testFiles,
		projectDir: testProjectDir,
		pkgManager: PkgManager.Npm,
		pkgManagerAlias: "myalias",
		modType: ModuleTypes.Commonjs,
	});

	const { time, ...stableResults } = await runner.runTests({
		timeout: 5000,
		testNames: [], // All tests
		reporter: mockReporter,
	});
	expect(stableResults).toEqual({
		passed: 2,
		failed: 1,
		skipped: 0,
		notReached: [],
		total: 3,
		failedFast: false,
	});
	expect(time).toBeGreaterThan(1);

	// Ensure the exec options match our expectation
	for (const testFile of testFiles) {
		expect(mockExec).toHaveBeenCalledWith(
			`npx ${testFile.actual}`,
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
		testCmd: `npx test1a`,
		testFile: {
			orig: "test1",
			actual: "test1a",
		},
		time: expect.any(Number),
		stdout: "normal std processes",
		stderr: "",
	});
	expect(mockReporter.failed).toHaveBeenCalledWith({
		testCmd: `npx test2a`,
		testFile: {
			orig: "test2",
			actual: "test2a",
		},
		time: expect.any(Number),
		stdout: "normal std processes",
		stderr: "whoa dang!",
		timedout: false,
	});
	expect(mockReporter.passed).toHaveBeenCalledWith({
		testCmd: `npx test3a`,
		testFile: {
			orig: "test3",
			actual: "test3a",
		},
		time: expect.any(Number),
		stdout: "normal std processes",
		stderr: "",
	});
	expect(mockReporter.skipped).not.toHaveBeenCalled();
	expect(mockReporter.summary).toHaveBeenCalledWith({
		time,
		...stableResults,
	});
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
					"normal std processes",
					"whoa dang!",
				);
			} else {
				cb(null, "normal std processes", "");
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
	const runner = new TestRunner({
		runCommand: "npx",
		runBy: RunBy.Node,
		testFiles,
		projectDir: testProjectDir,
		pkgManager: PkgManager.Npm,
		pkgManagerAlias: "myalias",
		modType: ModuleTypes.Commonjs,
		failFast: true,
	});

	const { time, ...stableResults } = await runner.runTests({
		timeout: 5000,
		testNames: [], // All tests
		reporter: mockReporter,
	});
	expect(stableResults).toEqual({
		passed: 1,
		failed: 1,
		skipped: 0,
		notReached: [
			{
				orig: "test3",
				actual: "test3a",
			},
		],
		total: 3,
		failedFast: true,
	});
	expect(time).toBeGreaterThan(1);

	// Ensure the exec options match our expectation
	for (const testFile of testFiles.slice(0, 2)) {
		expect(mockExec).toHaveBeenCalledWith(
			`npx ${testFile.actual}`,
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
		testCmd: `npx test1a`,
		testFile: {
			orig: "test1",
			actual: "test1a",
		},
		time: expect.any(Number),
		stdout: "normal std processes",
		stderr: "",
	});
	expect(mockReporter.failed).toHaveBeenCalledTimes(1);
	expect(mockReporter.failed).toHaveBeenCalledWith({
		testCmd: `npx test2a`,
		testFile: {
			orig: "test2",
			actual: "test2a",
		},
		time: expect.any(Number),
		stdout: "normal std processes",
		stderr: "whoa dang!",
		timedout: false,
	});
	expect(mockReporter.skipped).not.toHaveBeenCalled();
	expect(mockReporter.summary).toHaveBeenCalledWith({
		time,
		...stableResults,
	});
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
					"normal std processes",
					"whoa dang!",
				);
			}, 60);
		} else {
			setTimeout(() => {
				cb(null, "normal std processes", "");
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
	const runner = new TestRunner({
		runCommand: "npx",
		runBy: RunBy.Node,
		testFiles,
		projectDir: testProjectDir,
		pkgManager: PkgManager.Npm,
		pkgManagerAlias: "myalias",
		modType: ModuleTypes.Commonjs,
		failFast: false,
	});

	const { time, ...stableResults } = await runner.runTests({
		timeout: 50,
		testNames: [], // All tests
		reporter: mockReporter,
	});
	expect(stableResults).toEqual({
		passed: 2,
		failed: 1,
		skipped: 0,
		notReached: [],
		total: 3,
		failedFast: false,
	});
	expect(time).toBeGreaterThan(1);

	// Ensure the exec options match our expectation
	for (const testFile of testFiles) {
		expect(mockExec).toHaveBeenCalledWith(
			`npx ${testFile.actual}`,
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
		testCmd: `npx test1a`,
		testFile: {
			orig: "test1",
			actual: "test1a",
		},
		time: expect.any(Number),
		stdout: "normal std processes",
		stderr: "",
	});
	expect(mockReporter.passed).toHaveBeenCalledWith({
		testCmd: `npx test3a`,
		testFile: {
			orig: "test3",
			actual: "test3a",
		},
		time: expect.any(Number),
		stdout: "normal std processes",
		stderr: "",
	});
	expect(mockReporter.failed).toHaveBeenCalledTimes(1);
	expect(mockReporter.failed).toHaveBeenCalledWith({
		testCmd: `npx test2a`,
		testFile: {
			orig: "test2",
			actual: "test2a",
		},
		time: expect.any(Number),
		stdout: "normal std processes",
		stderr: "whoa dang!",
		timedout: true,
	});
	expect(mockReporter.skipped).not.toHaveBeenCalled();
	expect(mockReporter.summary).toHaveBeenCalledWith({
		time,
		...stableResults,
	});
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
					"normal std processes",
					"whoa dang!",
				);
			} else {
				cb(null, "normal std processes", "");
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
	const runner = new TestRunner({
		runCommand: "npx",
		runBy: RunBy.Node,
		testFiles,
		projectDir: testProjectDir,
		pkgManager: PkgManager.Npm,
		pkgManagerAlias: "myalias",
		modType: ModuleTypes.Commonjs,
		failFast: false,
	});

	const { time, ...stableResults } = await runner.runTests({
		timeout: 1000,
		testNames: ["**/*.ts"], // All tests
		reporter: mockReporter,
	});
	expect(stableResults).toEqual({
		passed: 2,
		failed: 0,
		skipped: 1,
		notReached: [],
		total: 3,
		failedFast: false,
	});
	expect(time).toBeGreaterThan(1);

	// Ensure the exec options match our expectation
	for (const testFile of testFiles.filter((tf) => tf.orig.endsWith(".ts"))) {
		expect(mockExec).toHaveBeenCalledWith(
			`npx ${testFile.actual}`,
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
		testCmd: `npx something/test1a.ts`,
		testFile: {
			orig: "something/test1.ts",
			actual: "something/test1a.ts",
		},
		time: expect.any(Number),
		stdout: "normal std processes",
		stderr: "",
	});
	expect(mockReporter.passed).toHaveBeenCalledWith({
		testCmd: `npx test3a.ts`,
		testFile: {
			orig: "test3.ts",
			actual: "test3a.ts",
		},
		time: expect.any(Number),
		stdout: "normal std processes",
		stderr: "",
	});
	expect(mockReporter.failed).not.toHaveBeenCalled();
	expect(mockReporter.skipped).toHaveBeenCalledTimes(1);
	expect(mockReporter.skipped).toHaveBeenCalledWith({
		testCmd: `npx else/test2a.ts`,
		testFile: {
			orig: "else/test2.js",
			actual: "else/test2a.ts",
		},
		time: 0,
	});
	expect(mockReporter.summary).toHaveBeenCalledWith({
		time,
		...stableResults,
	});
});
