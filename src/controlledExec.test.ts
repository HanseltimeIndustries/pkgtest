import { join, resolve } from "path";
import { CollectLogFilesOn, controlledExec } from "./controlledExec";
import { Logger, ScanForLogFilesLogger } from "./logging";
import { exec } from "child_process";

jest.mock("child_process");
var mockScanForLogFilesLoggerConst: jest.Mock;
jest.mock("./logging", () => {
	mockScanForLogFilesLoggerConst = jest.fn();
	return {
		ScanForLogFilesLogger: mockScanForLogFilesLoggerConst,
	};
});

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

const testCollectFolder = join("pkgtest", "run", "logs");

let mockScanForLogFilesLoggerInstance: ScanForLogFilesLogger = {
	log: jest.fn(),
	logDebug: jest.fn(),
	error: jest.fn(),
	collectLogFiles: jest.fn(),
	scanOnly: jest.fn(),
	logfiles: new Set<string>(),
	context: "scanLogger",
	debug: false,
	collectUnder: "collectUnderFolder",
	cwd: "cwdOfExec",
	logger: testLogger,
};
beforeEach(() => {
	jest.resetAllMocks();

	// Set up the scan dummy constructor to return an "instance" for us
	mockScanForLogFilesLoggerConst.mockReturnValue(
		mockScanForLogFilesLoggerInstance,
	);

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
	expect(mockScanForLogFilesLoggerConst).not.toHaveBeenCalled();
});

it("writes out debug logs on both stdio on normal return", async () => {
	expect(
		await controlledExec(
			testCommand,
			{
				cwd: "cwd",
			},
			testLogger,
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
	expect(mockScanForLogFilesLoggerConst).not.toHaveBeenCalled();
});

it.each([
	[CollectLogFilesOn.Error, false],
	[CollectLogFilesOn.Error, true],
	[CollectLogFilesOn.All, false],
	[CollectLogFilesOn.All, true],
])("collects logs on error (on: %s) (subFolder: %s)", async (on, subFolder) => {
	await expect(
		async () =>
			await controlledExec(
				testErrorCommand,
				{
					cwd: "cwd",
				},
				testLogger,
				{
					on,
					toFolder: testCollectFolder,
					...(subFolder
						? {
								subFolder: "sf1",
							}
						: {}),
				},
			),
	).rejects.toThrow("Dang");

	// Normal returns
	expect(mockExec).toHaveBeenCalledWith(
		testErrorCommand,
		{
			cwd: "cwd",
		},
		expect.anything(),
	);
	// Since we switch to the mocked scan logger we expect that one
	expect(mockScanForLogFilesLoggerConst).toHaveBeenCalledWith(
		testLogger,
		"cwd",
		subFolder ? resolve(testCollectFolder, "sf1") : resolve(testCollectFolder),
	);
	expect(mockScanForLogFilesLoggerInstance.log).toHaveBeenCalledWith(
		testStdOut,
	);
	expect(mockScanForLogFilesLoggerInstance.error).toHaveBeenCalledWith(
		testStdErr,
	);
	// Make sure we collected the logs
	expect(mockScanForLogFilesLoggerInstance.collectLogFiles).toHaveBeenCalled();
});

it("collects logs on normal return (on: All)", async () => {
	expect(
		await controlledExec(
			testCommand,
			{
				cwd: "cwd",
			},
			testLogger,
			{
				on: CollectLogFilesOn.All,
				toFolder: testCollectFolder,
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
	// Since we switch to the mocked scan logger we expect that one
	expect(mockScanForLogFilesLoggerConst).toHaveBeenCalledWith(
		testLogger,
		"cwd",
		resolve(testCollectFolder),
	);
	expect(mockScanForLogFilesLoggerInstance.logDebug).toHaveBeenCalledWith(
		testStdOut,
	);
	expect(mockScanForLogFilesLoggerInstance.logDebug).toHaveBeenCalledWith(
		testStdErr,
	);
	// Make sure we collected the logs
	expect(mockScanForLogFilesLoggerInstance.collectLogFiles).toHaveBeenCalled();
});

it("does not collect logs on normal return (on: Error)", async () => {
	expect(
		await controlledExec(
			testCommand,
			{
				cwd: "cwd",
			},
			testLogger,
			{
				on: CollectLogFilesOn.Error,
				toFolder: testCollectFolder,
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
	// Since we switch to the mocked scan logger we expect that one

	expect(testLogger.logDebug).toHaveBeenCalledWith(testStdOut);
	expect(testLogger.logDebug).toHaveBeenCalledWith(testStdErr);
	// We have no nded to have set up collection
	expect(mockScanForLogFilesLoggerConst).not.toHaveBeenCalled();
	// Make sure we collected the logs
	expect(
		mockScanForLogFilesLoggerInstance.collectLogFiles,
	).not.toHaveBeenCalled();
});

it("does collect logs on normal return with only return stdout", async () => {
	expect(
		await controlledExec(
			testCommand,
			{
				cwd: "cwd",
			},
			testLogger,
			{
				on: CollectLogFilesOn.All,
				toFolder: testCollectFolder,
			},
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
	// Since we switch to the mocked scan logger we expect that one
	expect(mockScanForLogFilesLoggerConst).toHaveBeenCalledWith(
		testLogger,
		"cwd",
		resolve(testCollectFolder),
	);
	expect(mockScanForLogFilesLoggerInstance.logDebug).not.toHaveBeenCalledWith(
		testStdOut,
	);
	expect(mockScanForLogFilesLoggerInstance.scanOnly).toHaveBeenCalledWith(
		testStdOut,
	);
	// We still debug log stderr
	expect(mockScanForLogFilesLoggerInstance.logDebug).toHaveBeenCalledWith(
		testStdErr,
	);
	// Make sure we collected the logs
	expect(mockScanForLogFilesLoggerInstance.collectLogFiles).toHaveBeenCalled();
});

it("does not log std on normal return with only return stdout", async () => {
	expect(
		await controlledExec(
			testCommand,
			{
				cwd: "cwd",
			},
			testLogger,
			false,
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

	expect(mockScanForLogFilesLoggerConst).not.toHaveBeenCalled();
	expect(testLogger.logDebug).not.toHaveBeenCalledWith(testStdOut);
	// We still debug log stderr
	expect(testLogger.logDebug).toHaveBeenCalledWith(testStdErr);
	// Make sure we collected the logs
	expect(
		mockScanForLogFilesLoggerInstance.collectLogFiles,
	).not.toHaveBeenCalled();
});
