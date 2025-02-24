import { Reporter, TestGroupOverview } from "../reporters";
import { ScriptTestRunner } from "./ScriptTestRunner";
import { ModuleTypes, PkgManager } from "../types";
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

beforeEach(() => {
	jest.resetAllMocks();
});

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
	});

	const overview = await runner.runTests();
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
				stdout: "normal std processes",
				stderr: "whoa dang!",
				timedout: false,
			});
		} else {
			expect(mockReporter.passed).toHaveBeenCalledWith({
				testCmd: cmd,
				test: {
					name,
				},
				time: expect.any(Number),
				stdout: "normal std processes",
				stderr: "",
			});
		}
	}

	expect(mockReporter.start).toHaveBeenCalledWith(runner);
	expect(mockReporter.skipped).not.toHaveBeenCalled();
	expect(mockReporter.summary).toHaveBeenCalledWith(overview);
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
	});

	const overview = await runner.runTests();
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
				stdout: "normal std processes",
				stderr: "whoa dang!",
				timedout: false,
			});
		} else {
			expect(mockReporter.passed).toHaveBeenCalledWith({
				testCmd: cmd,
				test: {
					name,
				},
				time: expect.any(Number),
				stdout: "normal std processes",
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
	});

	const overview = await runner.runTests();
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
				stdout: "normal std processes",
				stderr: "whoa dang!",
				timedout: true,
			});
		} else {
			expect(mockReporter.passed).toHaveBeenCalledWith({
				testCmd: cmd,
				test: {
					name,
				},
				time: expect.any(Number),
				stdout: "normal std processes",
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
// 					"normal std processes",
// 					"whoa dang!",
// 				);
// 			} else {
// 				cb(null, "normal std processes", "");
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
// 			`npx ${testFile.actual}`,
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
// 		testCmd: `npx something/test1a.ts`,
// 		test: {
// 			command: `npx something/test1a.ts`,
// 			orig: "something/test1.ts",
// 			actual: "something/test1a.ts",
// 		},
// 		time: expect.any(Number),
// 		stdout: "normal std processes",
// 		stderr: "",
// 	});
// 	expect(mockReporter.passed).toHaveBeenCalledWith({
// 		testCmd: `npx test3a.ts`,
// 		test: {
// 			command: `npx test3a.ts`,
// 			orig: "test3.ts",
// 			actual: "test3a.ts",
// 		},
// 		time: expect.any(Number),
// 		stdout: "normal std processes",
// 		stderr: "",
// 	});
// 	expect(mockReporter.failed).not.toHaveBeenCalled();
// 	expect(mockReporter.skipped).toHaveBeenCalledTimes(1);
// 	expect(mockReporter.skipped).toHaveBeenCalledWith({
// 		testCmd: `npx else/test2a.ts`,
// 		test: {
// 			command: `npx else/test2a.ts`,
// 			orig: "else/test2.js",
// 			actual: "else/test2a.ts",
// 		},
// 		time: 0,
// 	});
// 	expect(mockReporter.summary).toHaveBeenCalledWith(overview);
// });

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
