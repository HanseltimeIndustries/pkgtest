import { controlledExec } from "./controlledExec";
import { ExecExit, ILogFilesScanner, Logger } from "./logging";
import { exec } from "child_process";

jest.mock("child_process");

const mockExec = jest.mocked(exec);

const testLogger: Logger = {
	log: jest.fn(),
	logDebug: jest.fn(),
	error: jest.fn(),
	context: "testcontext",
	debug: false,
};

const testErrorCommand = "an error command";
const testCommand = "some command that works";

const testStdErr = "This is an error stream!  That was a bad idea! oh no!";
const testStdOut = "This is normal stream!";

const mockLogFilesScanner: ILogFilesScanner = {
	scanOnly: jest.fn(),
	collectLogFiles: jest.fn(),
	createNested: jest.fn(),
};

beforeEach(() => {
	jest.resetAllMocks();

	mockExec.mockImplementation((command, _options, cb) => {
		if (!cb) {
			throw new Error(`Not expecting no callback exec methods! ${command}`);
		}
		if (command === testErrorCommand) {
			cb(new Error("Dang"), testStdOut, testStdErr);
		} else if (command === testCommand) {
			cb(null, testStdOut, testStdErr);
		}

		return undefined as any;
	});
});

it("writes out both stdio on error", async () => {
	await expect(
		async () =>
			await controlledExec(
				testErrorCommand,
				{
					cwd: "cwd",
				},
				testLogger,
				mockLogFilesScanner,
			),
	).rejects.toThrow("Dang");

	expect(mockExec).toHaveBeenCalledWith(
		testErrorCommand,
		{
			cwd: "cwd",
		},
		expect.anything(),
	);
	expect(testLogger.log).toHaveBeenCalledWith(testStdOut);
	expect(testLogger.error).toHaveBeenCalledWith(testStdErr);

	// Optimization - make sure we don't scan if not collecting
	expect(mockLogFilesScanner.scanOnly).toHaveBeenCalledWith(
		testStdOut,
		"cwd",
		ExecExit.Error,
	);
	expect(mockLogFilesScanner.scanOnly).toHaveBeenCalledWith(
		testStdErr,
		"cwd",
		ExecExit.Error,
	);
});

it("writes out debug logs on both stdio on normal return", async () => {
	expect(
		await controlledExec(
			testCommand,
			{
				cwd: "cwd",
			},
			testLogger,
			mockLogFilesScanner,
		),
	).toEqual(testStdOut);

	expect(mockExec).toHaveBeenCalledWith(
		testCommand,
		{
			cwd: "cwd",
		},
		expect.anything(),
	);
	expect(testLogger.logDebug).toHaveBeenCalledWith(testStdOut);
	expect(testLogger.logDebug).toHaveBeenCalledWith(testStdErr);
	// Optimization - make sure we don't scan if not collecting
	expect(mockLogFilesScanner.scanOnly).toHaveBeenCalledWith(
		testStdOut,
		"cwd",
		ExecExit.Normal,
	);
	expect(mockLogFilesScanner.scanOnly).toHaveBeenCalledWith(
		testStdErr,
		"cwd",
		ExecExit.Normal,
	);
});

it("does not log std on normal return with only return stdout", async () => {
	expect(
		await controlledExec(
			testCommand,
			{
				cwd: "cwd",
			},
			testLogger,
			mockLogFilesScanner,
			{
				onlyReturnStdOut: true,
			},
		),
	).toEqual(testStdOut);

	// Normal returns
	expect(mockExec).toHaveBeenCalledWith(
		testCommand,
		{
			cwd: "cwd",
		},
		expect.anything(),
	);

	expect(testLogger.logDebug).not.toHaveBeenCalledWith(testStdOut);
	// We still debug log stderr
	expect(testLogger.logDebug).toHaveBeenCalledWith(testStdErr);
	// Make sure we collected the logs
	expect(mockLogFilesScanner.scanOnly).toHaveBeenCalledWith(
		testStdOut,
		"cwd",
		ExecExit.Normal,
	);
	expect(mockLogFilesScanner.scanOnly).toHaveBeenCalledWith(
		testStdErr,
		"cwd",
		ExecExit.Normal,
	);
});
