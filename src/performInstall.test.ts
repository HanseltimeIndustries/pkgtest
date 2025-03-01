import { join, resolve } from "path";
import {
	PATH_TO_PROJECT_KEY,
	performInstall,
	VERSION_PROJECT_KEY,
} from "./performInstall";
import { ILogFilesScanner, Logger } from "./logging";
import { ModuleTypes, PkgManager } from "./types";
import { existsSync } from "fs";
import { writeFile, readFile } from "fs/promises";
import { controlledExec } from "./controlledExec";
import {
	applyLockLocalFileEscaping,
	getPkgInstallCommand,
	getLocalPackagePath,
	lockFiles,
} from "./pkgManager";
import camelCase from "lodash.camelcase";

jest.mock("fs");
jest.mock("fs/promises");
jest.mock("./controlledExec");
jest.mock("./pkgManager");

const mockExistsSync = jest.mocked(existsSync);
const mockWriteFile = jest.mocked(writeFile);
const mockReadFile = jest.mocked(readFile);
const mockControlledExec = jest.mocked(controlledExec);
const mockGetPkgInstallCommand = jest.mocked(getPkgInstallCommand);
const mockGetLocalPackagePath = jest.mocked(getLocalPackagePath);
const mockApplyLockLocalFileEscaping = jest.mocked(applyLockLocalFileEscaping);

const testOrigProjectDir = "someProjectdir";
const testProjectDir = "testProjectDir";
const testRelPathToProject = join("..", "folder");
// Emulates the issue that package syntax is different than file path in lock files sometimes
const testLocalFilePath = `file:${testRelPathToProject}`;
const testRootDir = "pkgtest";
const testEnv = {};
const testEntryAlias = "someEntryAlias";
const testLogger = new Logger({
	context: "testLogger",
	debug: false,
});

const mockLogFilesScanner: ILogFilesScanner = {
	scanOnly: jest.fn(),
	collectLogFiles: jest.fn(),
	createNested: jest.fn(),
};

const testBaseContext = {
	projectDir: testOrigProjectDir,
	testProjectDir: testProjectDir,
	relPathToProject: testRelPathToProject,
	rootDir: testRootDir,
	env: testEnv,
	/**
	 * An alias string to track which entry is calling this (used for installation lock storage)
	 */
	entryAlias: testEntryAlias,
	logger: testLogger,
	logFilesScanner: mockLogFilesScanner,
};

const testBaseOptions = {
	modType: ModuleTypes.Commonjs,
	pkgManager: PkgManager.YarnBerry,
	pkgManagerAlias: "pkgManagerAlias",
	pkgManagerVersion: "someVersion",
	installCLiArgs: "cliArgs",
};
const testLockFolder = "someFolder";

const testPkgInstallCommand = "npm install";

const expectedLockfileCopyBackPath = resolve(
	testOrigProjectDir,
	testRootDir,
	testLockFolder,
	camelCase(testEntryAlias),
	testBaseOptions.modType,
	testBaseOptions.pkgManager,
	camelCase(testBaseOptions.pkgManagerAlias),
	lockFiles[testBaseOptions.pkgManager],
);
const expectedLockFileInProject = resolve(
	testProjectDir,
	lockFiles[testBaseOptions.pkgManager],
);

// Set up a lock file that will trigger substitutions
const testLockFile1 = `
Some lock file
pkg@${testLocalFilePath}

directory: ${testRelPathToProject}
`;
const expectedSubLockFile1 = `
Some lock file
pkg@\${${VERSION_PROJECT_KEY}}

directory: \${${PATH_TO_PROJECT_KEY}}
`;
const testLockFile2 = `
Some lock file
2pkg@${testLocalFilePath}

2directory: ${testRelPathToProject}
`;
const expectedSubLockFile2 = `
Some lock file
2pkg@\${${VERSION_PROJECT_KEY}}

2directory: \${${PATH_TO_PROJECT_KEY}}
`;

beforeEach(() => {
	jest.resetAllMocks();

	mockGetPkgInstallCommand.mockReturnValue(testPkgInstallCommand);
	mockGetLocalPackagePath.mockReturnValue(testLocalFilePath);
	mockApplyLockLocalFileEscaping.mockImplementation((_pkgManger, path) => {
		return path;
	});
	mockWriteFile.mockResolvedValue();
});

it("peforms an install without locks", async () => {
	await performInstall(
		{
			...testBaseContext,
			updateLock: false,
			isCI: false,
		},
		{
			...testBaseOptions,
			lock: false,
		},
	);

	expect(mockControlledExec).toHaveBeenCalledWith(
		testPkgInstallCommand,
		{
			cwd: testProjectDir,
			env: testEnv,
		},
		testLogger,
		mockLogFilesScanner,
	);
	// We wrote an empty lock file to avoid package managers looking for parents
	expect(mockWriteFile).toHaveBeenCalledWith(expectedLockFileInProject, "");
});

it("auto-writes missing lock file", async () => {
	mockExistsSync.mockImplementation((f) => {
		if (f.toString().includes(testProjectDir)) {
			return true;
		}
		if (f.toString().includes(testOrigProjectDir)) {
			return false;
		}
		return false;
	});
	mockReadFile.mockResolvedValue(testLockFile1);
	await performInstall(
		{
			...testBaseContext,
			updateLock: false,
			isCI: false,
		},
		{
			...testBaseOptions,
			lock: {
				folder: testLockFolder,
			},
		},
	);

	expect(mockControlledExec).toHaveBeenCalledWith(
		testPkgInstallCommand,
		{
			cwd: testProjectDir,
			env: testEnv,
		},
		testLogger,
		mockLogFilesScanner,
	);
	// The file was written back
	expect(mockExistsSync).toHaveBeenCalledWith(expectedLockFileInProject);
	expect(mockReadFile).toHaveBeenCalledWith(expectedLockFileInProject);
	expect(mockWriteFile).toHaveBeenCalledWith(
		expectedLockfileCopyBackPath,
		expectedSubLockFile1,
	);
});

it("auto-writes lock file if changes to existing", async () => {
	mockExistsSync.mockImplementation((f) => {
		if (f.toString().includes(testProjectDir)) {
			return true;
		}
		if (f.toString().includes(testOrigProjectDir)) {
			return true;
		}
		return false;
	});
	mockReadFile.mockImplementation(async (f) => {
		if (f.toString().includes(testProjectDir)) {
			return Buffer.from(testLockFile2);
		}
		if (f.toString().includes(testOrigProjectDir)) {
			return Buffer.from(expectedSubLockFile1);
		}
		return "should not have gotten here";
	});
	await performInstall(
		{
			...testBaseContext,
			updateLock: true,
			isCI: false,
		},
		{
			...testBaseOptions,
			lock: {
				folder: testLockFolder,
			},
		},
	);

	expect(mockControlledExec).toHaveBeenCalledWith(
		testPkgInstallCommand,
		{
			cwd: testProjectDir,
			env: testEnv,
		},
		testLogger,
		mockLogFilesScanner,
	);
	// The file was copied over
	// The resolved substitution was written
	expect(writeFile).toHaveBeenNthCalledWith(
		1,
		expectedLockFileInProject,
		testLockFile1,
	);
	// The file was written back
	expect(mockExistsSync).toHaveBeenCalledWith(expectedLockfileCopyBackPath);
	expect(mockExistsSync).toHaveBeenCalledWith(expectedLockFileInProject);
	expect(mockReadFile).toHaveBeenCalledWith(expectedLockFileInProject);
	expect(mockReadFile).toHaveBeenCalledWith(expectedLockfileCopyBackPath);
	// New substituted file was added
	expect(mockWriteFile).toHaveBeenNthCalledWith(
		2,
		expectedLockfileCopyBackPath,
		expectedSubLockFile2,
	);
});

it("does not write a lock file if no updateLock", async () => {
	mockExistsSync.mockImplementation((f) => {
		if (f.toString().includes(testProjectDir)) {
			return true;
		}
		if (f.toString().includes(testOrigProjectDir)) {
			return true;
		}
		return false;
	});
	mockReadFile.mockImplementation(async (f) => {
		if (f.toString().includes(testProjectDir)) {
			return Buffer.from(testLockFile1);
		}
		if (f.toString().includes(testOrigProjectDir)) {
			return Buffer.from(expectedSubLockFile1);
		}
		return "should not have gotten here";
	});
	await performInstall(
		{
			...testBaseContext,
			updateLock: false,
			isCI: false,
		},
		{
			...testBaseOptions,
			lock: {
				folder: testLockFolder,
			},
		},
	);

	expect(mockControlledExec).toHaveBeenCalledWith(
		testPkgInstallCommand,
		{
			cwd: testProjectDir,
			env: testEnv,
		},
		testLogger,
		mockLogFilesScanner,
	);
	// The file was copied over
	expect(writeFile).toHaveBeenNthCalledWith(
		1,
		expectedLockFileInProject,
		testLockFile1,
	);
	// The file was written back
	expect(mockExistsSync).toHaveBeenCalledWith(expectedLockfileCopyBackPath);
	expect(mockWriteFile).toHaveBeenCalledTimes(1);
});

it("does not write a lock file if no change", async () => {
	mockExistsSync.mockImplementation((f) => {
		if (f.toString().includes(testProjectDir)) {
			return true;
		}
		if (f.toString().includes(testOrigProjectDir)) {
			return true;
		}
		return false;
	});
	mockReadFile.mockImplementation(async (f) => {
		if (f.toString().includes(testProjectDir)) {
			return Buffer.from(testLockFile1);
		}
		if (f.toString().includes(testOrigProjectDir)) {
			return Buffer.from(expectedSubLockFile1);
		}
		return "should not have gotten here";
	});
	await performInstall(
		{
			...testBaseContext,
			updateLock: true,
			isCI: false,
		},
		{
			...testBaseOptions,
			lock: {
				folder: testLockFolder,
			},
		},
	);

	expect(mockControlledExec).toHaveBeenCalledWith(
		testPkgInstallCommand,
		{
			cwd: testProjectDir,
			env: testEnv,
		},
		testLogger,
		mockLogFilesScanner,
	);
	// The file was copied over
	expect(writeFile).toHaveBeenNthCalledWith(
		1,
		expectedLockFileInProject,
		testLockFile1,
	);
	// The file was written back
	expect(mockExistsSync).toHaveBeenCalledWith(expectedLockfileCopyBackPath);
	expect(mockWriteFile).toHaveBeenCalledTimes(1);
});

it("throws an error if isCI and no update lock and no existing lockfile", async () => {
	mockExistsSync.mockImplementation(() => {
		return false;
	});
	expect(
		async () =>
			await performInstall(
				{
					...testBaseContext,
					updateLock: false,
					isCI: true,
				},
				{
					...testBaseOptions,
					lock: {
						folder: testLockFolder,
					},
				},
			),
	).rejects.toThrow(
		`No lockfile found at ${expectedLockfileCopyBackPath}!  Please make sure you've committed the results of --update-lockfiles`,
	);

	expect(mockControlledExec).not.toHaveBeenCalled();
	// The file was copied over
	expect(writeFile).not.toHaveBeenCalled();
});
