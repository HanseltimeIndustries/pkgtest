import { createDependencies } from "./createDependencies";
import { getAllMatchingFiles, copyOverAdditionalFiles } from "./files";
import {
	getPkgBinaryRunnerCommand,
	getPkgManagerCommand,
	getPkgManagerSetCommand,
	getPkgInstallCommand,
	LockFileMode,
} from "./pkgManager";
import { getTypescriptConfig } from "./getTypescriptConfig";
import { cp, readFile, writeFile } from "fs/promises";
import { exec } from "child_process";
import {
	BUILD_DIRECTORY,
	createTestProject,
	SRC_DIRECTORY,
} from "./createTestProject";
import {
	ModuleTypes,
	PkgManager,
	PkgManagerBaseOptions,
	RunWith,
} from "./types";
import { join, resolve } from "path";
import { TsConfigJson } from "get-tsconfig";
import { AdditionalFilesCopy } from "./files/types";
import { SimpleReporter } from "./reporters/SimpleReporter";
import { TestGroupOverview } from "./reporters";

jest.mock("./createDependencies");
jest.mock("fs/promises");
jest.mock("child_process");
jest.mock("./files");
jest.mock("./pkgManager");
jest.mock("./getTypescriptConfig");
const mockCreateDependencies = jest.mocked(createDependencies);
const mockWriteFile = jest.mocked(writeFile);
const mockCp = jest.mocked(cp);
const mockExec = jest.mocked(exec);
const mockGetAllMatchingFiles = jest.mocked(getAllMatchingFiles);
const mockCopyOverAdditionalFiles = jest.mocked(copyOverAdditionalFiles);
const mockGetPkgManagerCommand = jest.mocked(getPkgManagerCommand);
const mockGetPkgBinaryRunnerCommand = jest.mocked(getPkgBinaryRunnerCommand);
const mockGetPkgManagerSetCommand = jest.mocked(getPkgManagerSetCommand);
const mockGetPkgInstallCommand = jest.mocked(getPkgInstallCommand);
const mockGetTypescriptConfig = jest.mocked(getTypescriptConfig);
const mockReadFile = jest.mocked(readFile);

const testTimeout = 3500;
const testReporter = new SimpleReporter({
	debug: false,
});
const testBinCmd = "corepack npx@latest";
const testPkgManagerCmd = "corepack npm@latest";
const testPkgManagerSetCmd = "corepack use npm@latest";
const testPkgInstallCmd = "corepack use npm@latest install conditional";
const testDeps = {
	dep1: "1.0.1",
	dep2: "^2.0.1",
};
const projectUnderTestDirName = "packageUnderTest";
const testProjectUnderTestDir = resolve(process.cwd(), projectUnderTestDirName);
const testProjectDir = resolve(process.cwd(), "someNesting", "testProjectDir");
const test1FileName = "test1.pkgtest.ts";
const test2FileName = "test2.pkgtest.ts";
const testMatchingTests = [
	`${testProjectUnderTestDir}/something/${test1FileName}`,
	`${testProjectUnderTestDir}/${test2FileName}`,
];
const testTsConfig: TsConfigJson = {
	compilerOptions: {
		strict: true,
		module: "commonjs",
		outDir: BUILD_DIRECTORY, // This is the way it's actually created
	},
};
const testEntryAlias = "entrySomething";
const testAdditionalDeps = {
	addDep: "3.0.0",
};
const testAdditionalFiles: AdditionalFilesCopy[] = [
	{
		files: ["addFile1.txt", "addFile2.txt"],
		toDir: "./something",
	},
	{
		files: ["someDir/", "anotherDir/"],
		toDir: "./",
	},
];
const testrootDir = "./pkgtests";
const testMatchIgnore = ["someglob"];

const testPkgManagerOptions: PkgManagerBaseOptions = {
	installCliArgs: "some args",
};
const testPkgManagerVersion = "3.8.2";

// Since yarn plug'n'play pollutes NODE_OPTIONS, we invalidate it in our exec scripts
const expectedSanitizedEnv = {
	...process.env,
	NODE_OPTIONS: "",
	npm_package_json: join(testProjectDir, "package.json"),
};

describe.each([[ModuleTypes.Commonjs], [ModuleTypes.ESM]])(
	"For module type %s",
	(modType) => {
		beforeEach(() => {
			jest.resetAllMocks();

			mockCreateDependencies.mockReturnValue(testDeps);
			mockGetAllMatchingFiles.mockResolvedValue(testMatchingTests);
			mockGetPkgBinaryRunnerCommand.mockReturnValue(testBinCmd);
			mockGetPkgManagerCommand.mockReturnValue(testPkgManagerCmd);
			mockGetPkgManagerSetCommand.mockReturnValue(testPkgManagerSetCmd);
			mockGetTypescriptConfig.mockReturnValue(testTsConfig as any);
			mockGetPkgInstallCommand.mockReturnValue(testPkgInstallCmd);
			mockCp.mockResolvedValue();
			mockWriteFile.mockResolvedValue();
			mockExec.mockImplementation((command, _options, cb) => {
				if (!cb) {
					throw new Error(`Not expecting no callback exec methods! ${command}`);
				}
				cb(null, "stdout", "stderr");
				return undefined as any;
			});
		});

		const expectedTypeField =
			modType === ModuleTypes.ESM
				? {
						type: "module",
					}
				: {};

		it("creates a project for and returns the various runners for non-typescript", async () => {
			const testPackageJson = {
				name: "testProject",
			};
			mockReadFile.mockImplementation(async (file) => {
				if (typeof file === "string" && file.endsWith("package.json")) {
					return Buffer.from(JSON.stringify(testPackageJson));
				}
				throw new Error("Unimplemented file read mocking " + file);
			});
			const expectedRelativeInstallPath = join(
				"..",
				"..",
				projectUnderTestDirName,
			); // Since the the package under test dir at cwd + dir
			const { fileTestRunners: testRunners, binTestRunner } =
				await createTestProject(
					{
						projectDir: testProjectUnderTestDir,
						testProjectDir,
						rootDir: testrootDir,
						matchIgnore: testMatchIgnore,
						lock: false,
						entryAlias: testEntryAlias,
						isCI: false,
						updateLock: false,
					},
					{
						modType,
						pkgManager: PkgManager.YarnV1,
						additionalFiles: testAdditionalFiles,
						pkgManagerAlias: "myalias",
						pkgManagerOptions: testPkgManagerOptions,
						pkgManagerVersion: testPkgManagerVersion,
						fileTests: {
							runWith: [RunWith.Node],
							testMatch: "some**glob",
						},
						timeout: testTimeout,
						reporter: testReporter,
					},
				);

			const expectedCopyOver = testMatchingTests.map((t) => {
				return {
					copiedTo: t.replace(
						testProjectUnderTestDir,
						join(testProjectDir, SRC_DIRECTORY),
					),
					from: t,
					// The normalized from for pattern matching
					fromNorm: t.replace(testProjectUnderTestDir + "/", ""),
				};
			});
			expect(testRunners).toHaveLength(1);
			expect(testRunners[0]).toEqual({
				runCommand: `${testBinCmd} ${RunWith.Node}`,
				runBy: RunWith.Node,
				testFiles: expectedCopyOver.map((e) => {
					return {
						orig: e.fromNorm,
						actual: e.copiedTo,
					};
				}),
				projectDir: testProjectDir,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				modType,
				failFast: false,
				baseEnv: expectedSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
			});
			expect(binTestRunner).toBeUndefined();

			// confirm corepack use called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(),
			);

			// confirm pkg install command called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgInstallCmd,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(),
			);

			// Confirm command retrieval functions called with versions
			expect(mockGetPkgBinaryRunnerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerSetCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgInstallCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				LockFileMode.None,
				testPkgManagerOptions.installCliArgs,
				testPkgManagerVersion,
			);

			// Confirm correct function calls to mocks
			expect(mockCreateDependencies).toHaveBeenCalledWith(
				testPackageJson,
				expectedRelativeInstallPath,
				{
					runBy: [RunWith.Node],
					pkgManager: PkgManager.YarnV1,
					additionalDependencies: {},
					// No typescript options provided
				},
			);
			expect(mockWriteFile).toHaveBeenCalledWith(
				join(testProjectDir, "package.json"),
				JSON.stringify(
					{
						name: `@dummy-test-package/test-${modType}`,
						version: "0.0.0",
						description: `Compiled tests for ${testPackageJson.name} as ${modType} project import`,
						...expectedTypeField,
						private: true,
						// These were populated by the createDependencies method we mocked
						dependencies: {
							...testDeps,
						},
					},
					null,
					4,
				),
			);
			expect(mockGetAllMatchingFiles).toHaveBeenCalledWith(
				resolve(testProjectUnderTestDir, testrootDir),
				"some**glob",
				testMatchIgnore,
			);
			for (const { copiedTo, from } of expectedCopyOver) {
				expect(mockCp).toHaveBeenCalledWith(from, copiedTo);
			}
			// expect we copied files
			expect(mockCopyOverAdditionalFiles).toHaveBeenCalledWith(
				testAdditionalFiles,
				testProjectDir,
			);
		});

		it("creates a project and respects the explicit devDependencies", async () => {
			const testPackageJson = {
				name: "testProject",
			};
			mockReadFile.mockImplementation(async (file) => {
				if (typeof file === "string" && file.endsWith("package.json")) {
					return Buffer.from(JSON.stringify(testPackageJson));
				}
				throw new Error("Unimplemented file read mocking " + file);
			});
			const expectedRelativeInstallPath = join(
				"..",
				"..",
				projectUnderTestDirName,
			); // Since the the package under test dir at cwd + dir
			const { fileTestRunners: testRunners, binTestRunner } =
				await createTestProject(
					{
						projectDir: testProjectUnderTestDir,
						testProjectDir,
						rootDir: testrootDir,
						matchIgnore: testMatchIgnore,
						lock: false,
						entryAlias: testEntryAlias,
						isCI: false,
						updateLock: false,
					},
					{
						modType,
						pkgManager: PkgManager.YarnV1,
						additionalFiles: testAdditionalFiles,
						pkgManagerAlias: "myalias",
						pkgManagerOptions: testPkgManagerOptions,
						pkgManagerVersion: testPkgManagerVersion,
						fileTests: {
							runWith: [RunWith.Node],
							testMatch: "some**glob",
						},
						timeout: testTimeout,
						reporter: testReporter,
						packageJson: {
							// This should stay in dev dependencies
							devDependencies: {
								tsx: "2.0.0",
							},
							anotherField: "someValue",
						},
					},
				);

			const expectedCopyOver = testMatchingTests.map((t) => {
				return {
					copiedTo: t.replace(
						testProjectUnderTestDir,
						join(testProjectDir, SRC_DIRECTORY),
					),
					from: t,
					// The normalized from for pattern matching
					fromNorm: t.replace(testProjectUnderTestDir + "/", ""),
				};
			});
			expect(testRunners).toHaveLength(1);
			expect(testRunners[0]).toEqual({
				runCommand: `${testBinCmd} ${RunWith.Node}`,
				runBy: RunWith.Node,
				testFiles: expectedCopyOver.map((e) => {
					return {
						orig: e.fromNorm,
						actual: e.copiedTo,
					};
				}),
				projectDir: testProjectDir,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				modType,
				failFast: false,
				baseEnv: expectedSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
			});
			expect(binTestRunner).toBeUndefined();

			// confirm corepack use called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(),
			);

			// confirm pkg install command called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgInstallCmd,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(),
			);

			// Confirm command retrieval functions called with versions
			expect(mockGetPkgBinaryRunnerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerSetCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgInstallCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				LockFileMode.None,
				testPkgManagerOptions.installCliArgs,
				testPkgManagerVersion,
			);

			// Confirm correct function calls to mocks
			expect(mockCreateDependencies).toHaveBeenCalledWith(
				testPackageJson,
				expectedRelativeInstallPath,
				{
					runBy: [RunWith.Node],
					pkgManager: PkgManager.YarnV1,
					additionalDependencies: {},
					// No typescript options provided
				},
			);
			expect(mockWriteFile).toHaveBeenCalledWith(
				join(testProjectDir, "package.json"),
				JSON.stringify(
					{
						name: `@dummy-test-package/test-${modType}`,
						version: "0.0.0",
						description: `Compiled tests for ${testPackageJson.name} as ${modType} project import`,
						...expectedTypeField,
						private: true,
						devDependencies: {
							tsx: "2.0.0",
						},
						anotherField: "someValue",
						// These were populated by the createDependencies method we mocked
						dependencies: {
							...testDeps,
						},
					},
					null,
					4,
				),
			);
			expect(mockGetAllMatchingFiles).toHaveBeenCalledWith(
				resolve(testProjectUnderTestDir, testrootDir),
				"some**glob",
				testMatchIgnore,
			);
			for (const { copiedTo, from } of expectedCopyOver) {
				expect(mockCp).toHaveBeenCalledWith(from, copiedTo);
			}
			// expect we copied files
			expect(mockCopyOverAdditionalFiles).toHaveBeenCalledWith(
				testAdditionalFiles,
				testProjectDir,
			);
		});

		it("creates a project for and returns the various runner for typescript based node running", async () => {
			const testPackageJson = {
				name: "testProject",
			};
			mockReadFile.mockImplementation(async (file) => {
				if (typeof file === "string" && file.endsWith("package.json")) {
					return Buffer.from(JSON.stringify(testPackageJson));
				}
				throw new Error("Unimplemented file read mocking " + file);
			});
			const expectedRelativeInstallPath = join(
				"..",
				"..",
				projectUnderTestDirName,
			); // Since the the package under test dir at cwd + dir
			const typescriptOptions = {
				config: {
					exclude: ["tmp"],
				},
				version: "someTsVersion",
			};
			const { fileTestRunners: testRunners, binTestRunner } =
				await createTestProject(
					{
						projectDir: testProjectUnderTestDir,
						testProjectDir,
						rootDir: testrootDir,
						matchIgnore: testMatchIgnore,
						lock: false,
						entryAlias: testEntryAlias,
						isCI: false,
						updateLock: false,
					},
					{
						modType: modType,
						pkgManager: PkgManager.YarnV1,
						pkgManagerAlias: "myalias",
						pkgManagerOptions: testPkgManagerOptions,
						pkgManagerVersion: testPkgManagerVersion,
						additionalFiles: testAdditionalFiles,
						fileTests: {
							runWith: [RunWith.Node],
							testMatch: "some**glob",
							transforms: {
								// Just providing typescript object will do
								typescript: typescriptOptions,
							},
						},
						timeout: testTimeout,
						reporter: testReporter,
					},
				);

			// confirm corepack use called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(),
			);

			// confirm pkg install command called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgInstallCmd,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(),
			);

			// Confirm command retrieval functions called with versions
			expect(mockGetPkgBinaryRunnerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerSetCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgInstallCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				LockFileMode.None,
				testPkgManagerOptions.installCliArgs,
				testPkgManagerVersion,
			);

			const expectedCopyOver = testMatchingTests.map((t) => {
				return {
					copiedTo: t.replace(
						testProjectUnderTestDir,
						join(testProjectDir, SRC_DIRECTORY),
					),
					builtTo: t
						.replace(
							testProjectUnderTestDir,
							join(testProjectDir, BUILD_DIRECTORY),
						)
						.replace(".ts", ".js"),
					from: t,
					// The normalized from for pattern matching
					fromNorm: t.replace(testProjectUnderTestDir + "/", ""),
				};
			});
			expect(testRunners).toHaveLength(1);
			expect(testRunners[0]).toEqual({
				runCommand: `${testBinCmd} ${RunWith.Node}`,
				runBy: RunWith.Node,
				testFiles: expectedCopyOver.map((e) => {
					return {
						orig: e.fromNorm,
						actual: e.builtTo,
					};
				}),
				projectDir: testProjectDir,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				modType: modType,
				failFast: false,
				baseEnv: expectedSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
			});
			expect(binTestRunner).toBeUndefined();

			// Confirm correct function calls to mocks
			expect(mockCreateDependencies).toHaveBeenCalledWith(
				testPackageJson,
				expectedRelativeInstallPath,
				{
					runBy: [RunWith.Node],
					pkgManager: PkgManager.YarnV1,
					typescript: typescriptOptions,
					additionalDependencies: {},
				},
			);
			expect(mockWriteFile).toHaveBeenCalledWith(
				join(testProjectDir, "package.json"),
				JSON.stringify(
					{
						name: `@dummy-test-package/test-${modType}`,
						version: "0.0.0",
						description: `Compiled tests for ${testPackageJson.name} as ${modType} project import`,
						...expectedTypeField,
						private: true,
						// These were populated by the createDependencies method we mocked
						dependencies: {
							...testDeps,
						},
					},
					null,
					4,
				),
			);
			expect(mockGetAllMatchingFiles).toHaveBeenCalledWith(
				resolve(testProjectUnderTestDir, testrootDir),
				"some**glob",
				testMatchIgnore,
			);
			for (const { copiedTo, from } of expectedCopyOver) {
				expect(mockCp).toHaveBeenCalledWith(from, copiedTo);
			}
			// Make sure we wrote out tsconfig and commpiled
			const expectedConfigFile = `tsconfig.${modType}.json`;
			expect(writeFile).toHaveBeenCalledWith(
				join(testProjectDir, expectedConfigFile),
				JSON.stringify(testTsConfig, null, 4),
			);
			expect(mockExec).toHaveBeenCalledWith(
				`${testBinCmd} tsc -p ${expectedConfigFile}`,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(), // callback
			);
			// expect we copied files
			expect(mockCopyOverAdditionalFiles).toHaveBeenCalledWith(
				testAdditionalFiles,
				testProjectDir,
			);
		});

		it("creates a project for various runners and a BinTestRunner", async () => {
			const testPackageJson = {
				name: "testProject",
			};
			mockReadFile.mockImplementation(async (file) => {
				if (typeof file === "string" && file.endsWith("package.json")) {
					return Buffer.from(JSON.stringify(testPackageJson));
				}
				throw new Error("Unimplemented file read mocking " + file);
			});
			const expectedRelativeInstallPath = join(
				"..",
				"..",
				projectUnderTestDirName,
			); // Since the the package under test dir at cwd + dir
			const typescriptOptions = {
				config: {
					exclude: ["tmp"],
				},
				version: "someTsVersion",
			};
			const { fileTestRunners: testRunners, binTestRunner } =
				await createTestProject(
					{
						projectDir: testProjectUnderTestDir,
						testProjectDir,
						rootDir: testrootDir,
						matchIgnore: testMatchIgnore,
						lock: false,
						entryAlias: testEntryAlias,
						isCI: false,
						updateLock: false,
					},
					{
						fileTests: {
							runWith: [RunWith.Node],
							testMatch: "some**glob",
							transforms: {
								// Just providing typescript object will do
								typescript: typescriptOptions,
							},
						},
						timeout: testTimeout,
						reporter: testReporter,
						modType: modType,
						pkgManager: PkgManager.YarnV1,
						pkgManagerAlias: "myalias",
						pkgManagerOptions: testPkgManagerOptions,
						pkgManagerVersion: testPkgManagerVersion,
						additionalFiles: testAdditionalFiles,
						binTests: {
							bin1: [
								{
									args: "--help",
									env: {
										something: "here",
									},
								},
							],
							bin2: [
								{
									args: "someArg",
								},
								{
									args: "someArg",
									env: {
										another: "val",
									},
								},
							],
						},
					},
				);

			// confirm corepack use called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(),
			);

			// confirm pkg install command called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgInstallCmd,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(),
			);

			// Confirm command retrieval functions called with versions
			expect(mockGetPkgBinaryRunnerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerSetCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgInstallCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				LockFileMode.None,
				testPkgManagerOptions.installCliArgs,
				testPkgManagerVersion,
			);

			const expectedCopyOver = testMatchingTests.map((t) => {
				return {
					copiedTo: t.replace(
						testProjectUnderTestDir,
						join(testProjectDir, SRC_DIRECTORY),
					),
					builtTo: t
						.replace(
							testProjectUnderTestDir,
							join(testProjectDir, BUILD_DIRECTORY),
						)
						.replace(".ts", ".js"),
					from: t,
					// The normalized from for pattern matching
					fromNorm: t.replace(testProjectUnderTestDir + "/", ""),
				};
			});
			expect(testRunners).toHaveLength(1);
			expect(testRunners[0]).toEqual({
				runCommand: `${testBinCmd} ${RunWith.Node}`,
				runBy: RunWith.Node,
				testFiles: expectedCopyOver.map((e) => {
					return {
						orig: e.fromNorm,
						actual: e.builtTo,
					};
				}),
				projectDir: testProjectDir,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				modType: modType,
				failFast: false,
				baseEnv: expectedSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
			});
			expect(binTestRunner).toEqual({
				runCommand: testBinCmd,
				projectDir: testProjectDir,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				modType: modType,
				failFast: false,
				baseEnv: expectedSanitizedEnv,
				binTestConfig: {
					bin1: [
						{
							args: "--help",
							env: {
								something: "here",
							},
						},
					],
					bin2: [
						{
							args: "someArg",
						},
						{
							args: "someArg",
							env: {
								another: "val",
							},
						},
					],
				},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
			});

			// Confirm correct function calls to mocks
			expect(mockCreateDependencies).toHaveBeenCalledWith(
				testPackageJson,
				expectedRelativeInstallPath,
				{
					runBy: [RunWith.Node],
					pkgManager: PkgManager.YarnV1,
					typescript: typescriptOptions,
					additionalDependencies: {},
				},
			);
			expect(mockWriteFile).toHaveBeenCalledWith(
				join(testProjectDir, "package.json"),
				JSON.stringify(
					{
						name: `@dummy-test-package/test-${modType}`,
						version: "0.0.0",
						description: `Compiled tests for ${testPackageJson.name} as ${modType} project import`,
						...expectedTypeField,
						private: true,
						// These were populated by the createDependencies method we mocked
						dependencies: {
							...testDeps,
						},
					},
					null,
					4,
				),
			);
			expect(mockGetAllMatchingFiles).toHaveBeenCalledWith(
				resolve(testProjectUnderTestDir, testrootDir),
				"some**glob",
				testMatchIgnore,
			);
			for (const { copiedTo, from } of expectedCopyOver) {
				expect(mockCp).toHaveBeenCalledWith(from, copiedTo);
			}
			// Make sure we wrote out tsconfig and commpiled
			const expectedConfigFile = `tsconfig.${modType}.json`;
			expect(writeFile).toHaveBeenCalledWith(
				join(testProjectDir, expectedConfigFile),
				JSON.stringify(testTsConfig, null, 4),
			);
			expect(mockExec).toHaveBeenCalledWith(
				`${testBinCmd} tsc -p ${expectedConfigFile}`,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(), // callback
			);
			// expect we copied files
			expect(mockCopyOverAdditionalFiles).toHaveBeenCalledWith(
				testAdditionalFiles,
				testProjectDir,
			);
		});

		const allRunBy = Object.values(RunWith);
		it(`creates a project for and returns the various runners for typescript based running on ${allRunBy.join(", ")}`, async () => {
			const testPackageJson = {
				name: "testProject",
			};
			mockReadFile.mockImplementation(async (file) => {
				if (typeof file === "string" && file.endsWith("package.json")) {
					return Buffer.from(JSON.stringify(testPackageJson));
				}
				throw new Error("Unimplemented file read mocking " + file);
			});
			const expectedRelativeInstallPath = join(
				"..",
				"..",
				projectUnderTestDirName,
			); // Since the the package under test dir at cwd + dir
			const typescriptOptions = {
				config: {
					exclude: ["tmp"],
				},
				version: "someTsVersion",
			};
			const { fileTestRunners: testRunners, binTestRunner } =
				await createTestProject(
					{
						projectDir: testProjectUnderTestDir,
						testProjectDir,
						rootDir: testrootDir,
						matchIgnore: testMatchIgnore,
						lock: false,
						entryAlias: testEntryAlias,
						isCI: false,
						updateLock: false,
					},
					{
						modType,
						pkgManager: PkgManager.YarnV1,
						pkgManagerAlias: "myalias",
						pkgManagerOptions: testPkgManagerOptions,
						pkgManagerVersion: testPkgManagerVersion,
						// Just providing typescript object will do
						packageJson: {
							dependencies: testAdditionalDeps,
						},
						additionalFiles: testAdditionalFiles,
						fileTests: {
							runWith: allRunBy,
							testMatch: "some**glob",
							transforms: {
								typescript: typescriptOptions,
							},
						},
						timeout: testTimeout,
						reporter: testReporter,
					},
				);

			// confirm corepack use called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(),
			);

			// confirm pkg install command called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgInstallCmd,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(),
			);

			// Confirm command retrieval functions called with versions
			expect(mockGetPkgBinaryRunnerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerSetCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgInstallCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				LockFileMode.None,
				testPkgManagerOptions.installCliArgs,
				testPkgManagerVersion,
			);

			const expectedCopyOver = testMatchingTests.map((t) => {
				return {
					copiedTo: t.replace(
						testProjectUnderTestDir,
						join(testProjectDir, SRC_DIRECTORY),
					),
					builtTo: t
						.replace(
							testProjectUnderTestDir,
							join(testProjectDir, BUILD_DIRECTORY),
						)
						.replace(".ts", ".js"),
					from: t,
					// The normalized from for pattern matching
					fromNorm: t.replace(testProjectUnderTestDir + "/", ""),
				};
			});
			const expectedConfigFile = `tsconfig.${modType}.json`;
			expect(testRunners).toHaveLength(Object.values(RunWith).length);
			expect(testRunners).toContainEqual({
				runCommand: `${testBinCmd} ${RunWith.Node}`,
				runBy: RunWith.Node,
				testFiles: expectedCopyOver.map((e) => {
					return {
						orig: e.fromNorm,
						actual: e.builtTo,
					};
				}),
				projectDir: testProjectDir,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				modType,
				failFast: false,
				baseEnv: expectedSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
			});
			expect(testRunners).toContainEqual({
				// Since Ts-node doesn't really work the same with esm, the command changes
				runCommand:
					modType === ModuleTypes.Commonjs
						? `${testBinCmd} ts-node --project ${expectedConfigFile}`
						: `${testBinCmd} node --loader ts-node/esm`,
				runBy: RunWith.TsNode,
				testFiles: expectedCopyOver.map((e) => {
					return {
						orig: e.fromNorm,
						actual: e.copiedTo,
					};
				}),
				projectDir: testProjectDir,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				modType,
				failFast: false,
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
				baseEnv: expectedSanitizedEnv,
				extraEnv:
					modType === ModuleTypes.Commonjs
						? {}
						: {
								TS_NODE_PROJECT: expectedConfigFile,
							},
			});
			expect(testRunners).toContainEqual({
				runCommand: `${testBinCmd} tsx --tsconfig ${expectedConfigFile}`,
				runBy: RunWith.Tsx,
				testFiles: expectedCopyOver.map((e) => {
					return {
						orig: e.fromNorm,
						actual: e.copiedTo,
					};
				}),
				projectDir: testProjectDir,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				modType,
				failFast: false,
				baseEnv: expectedSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
			});
			expect(binTestRunner).toBeUndefined();

			// Confirm correct function calls to mocks
			expect(mockCreateDependencies).toHaveBeenCalledWith(
				testPackageJson,
				expectedRelativeInstallPath,
				{
					runBy: allRunBy,
					pkgManager: PkgManager.YarnV1,
					typescript: typescriptOptions,
					additionalDependencies: testAdditionalDeps,
				},
			);
			expect(mockWriteFile).toHaveBeenCalledWith(
				join(testProjectDir, "package.json"),
				JSON.stringify(
					{
						name: `@dummy-test-package/test-${modType}`,
						version: "0.0.0",
						description: `Compiled tests for ${testPackageJson.name} as ${modType} project import`,
						...expectedTypeField,
						private: true,
						// These were populated by the createDependencies method we mocked
						dependencies: {
							...testDeps,
						},
					},
					null,
					4,
				),
			);
			expect(mockGetAllMatchingFiles).toHaveBeenCalledWith(
				resolve(testProjectUnderTestDir, testrootDir),
				"some**glob",
				testMatchIgnore,
			);
			for (const { copiedTo, from } of expectedCopyOver) {
				expect(mockCp).toHaveBeenCalledWith(from, copiedTo);
			}
			// Make sure we wrote out tsconfig and commpiled
			expect(writeFile).toHaveBeenCalledWith(
				join(testProjectDir, expectedConfigFile),
				JSON.stringify(testTsConfig, null, 4),
			);
			expect(mockExec).toHaveBeenCalledWith(
				`${testBinCmd} tsc -p ${expectedConfigFile}`,
				{
					cwd: testProjectDir,
					env: expectedSanitizedEnv,
				},
				expect.anything(), // callback
			);
			// expect we copied files
			expect(mockCopyOverAdditionalFiles).toHaveBeenCalledWith(
				testAdditionalFiles,
				testProjectDir,
			);
		});
	},
);

it("throws an error if the projectdir is not absolute", async () => {
	await expect(async () => {
		await createTestProject(
			{
				projectDir: "someUnderTest",
				testProjectDir: join(process.cwd(), "testProjectDir"),
				rootDir: testrootDir,
				matchIgnore: testMatchIgnore,
				lock: false,
				entryAlias: testEntryAlias,
				isCI: false,
				updateLock: false,
			},
			{
				modType: ModuleTypes.Commonjs,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				additionalFiles: [],
				fileTests: {
					runWith: [RunWith.Node],
					testMatch: "some**glob",
				},
				timeout: testTimeout,
				reporter: testReporter,
			},
		);
	}).rejects.toThrow("projectDir must be absolute path!");
});

it("throws an error if the testProjectDir is not absolute", async () => {
	await expect(async () => {
		await createTestProject(
			{
				projectDir: join(process.cwd(), "someUnderTest"),
				testProjectDir: "testProjectDir",
				rootDir: testrootDir,
				matchIgnore: testMatchIgnore,
				lock: false,
				entryAlias: testEntryAlias,
				isCI: false,
				updateLock: false,
			},
			{
				modType: ModuleTypes.Commonjs,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				additionalFiles: [],
				fileTests: {
					runWith: [RunWith.Node],
					testMatch: "some**glob",
				},
				timeout: testTimeout,
				reporter: testReporter,
			},
		);
	}).rejects.toThrow("testProjectDir must be absolute path!");
});
