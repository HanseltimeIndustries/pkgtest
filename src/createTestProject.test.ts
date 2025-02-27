import { createDependencies } from "./createDependencies";
import { getAllMatchingFiles, copyOverAdditionalFiles } from "./files";
import {
	getPkgBinaryRunnerCommand,
	getPkgManagerSetCommand,
	getPkgInstallCommand,
	sanitizeEnv,
} from "./pkgManager";
import { getTypescriptConfig } from "./getTypescriptConfig";
import { cp, readFile, writeFile } from "fs/promises";
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
import { join, relative, resolve } from "path";
import { TsConfigJson } from "get-tsconfig";
import { AdditionalFilesCopy } from "./files/types";
import { SimpleReporter } from "./reporters/SimpleReporter";
import { TestGroupOverview } from "./reporters";
import { StandardizedTestConfig } from "./config";
import { controlledExec } from "./controlledExec";
import { performInstall } from "./performInstall";
import { ILogFilesScanner, Logger } from "./logging";

jest.mock("./createDependencies");
jest.mock("fs/promises");
jest.mock("./files");
jest.mock("./pkgManager");
jest.mock("./getTypescriptConfig");
jest.mock("./controlledExec");
jest.mock("./performInstall");
const mockCreateDependencies = jest.mocked(createDependencies);
const mockWriteFile = jest.mocked(writeFile);
const mockCp = jest.mocked(cp);
const mockControlledExec = jest.mocked(controlledExec);
const mockGetAllMatchingFiles = jest.mocked(getAllMatchingFiles);
const mockCopyOverAdditionalFiles = jest.mocked(copyOverAdditionalFiles);
const mockGetPkgBinaryRunnerCommand = jest.mocked(getPkgBinaryRunnerCommand);
const mockGetPkgManagerSetCommand = jest.mocked(getPkgManagerSetCommand);
const mockGetPkgInstallCommand = jest.mocked(getPkgInstallCommand);
const mockGetTypescriptConfig = jest.mocked(getTypescriptConfig);
const mockReadFile = jest.mocked(readFile);
const mockSanitizeEnv = jest.mocked(sanitizeEnv);
const mockPerformInstall = jest.mocked(performInstall);

const mockTopLevelLogFilesScanner: ILogFilesScanner = {
	scanOnly: jest.fn(),
	collectLogFiles: jest.fn(),
	createNested: jest.fn(),
};
const mockProjectLevelLogFilesScanner: ILogFilesScanner = {
	scanOnly: jest.fn(),
	collectLogFiles: jest.fn(),
	createNested: jest.fn(),
};
const mockPerExecLogFilesScanner: ILogFilesScanner = {
	scanOnly: jest.fn(),
	collectLogFiles: jest.fn(),
	createNested: jest.fn(),
};

const testTimeout = 3500;
const testReporter = new SimpleReporter({
	debug: false,
});
const testBinCmd = "corepack npx@latest";
const testPkgManagerSetCmd = "corepack use npm@latest";
const testPkgInstallCmd = "corepack use npm@latest install conditional";
const testDeps = {
	dep1: "1.0.1",
	dep2: "^2.0.1",
};
const testConfig = {} as StandardizedTestConfig;
const projectUnderTestDirName = "packageUnderTest";
const testProjectUnderTestDir = resolve(process.cwd(), projectUnderTestDirName);
const testProjectDir = resolve(process.cwd(), "someNesting", "testProjectDir");
const test1FileName = "test1.pkgtest.ts";
const test2FileName = "test2.pkgtest.ts";
const testMatchingTests = [
	join(testProjectUnderTestDir, "something", test1FileName),
	join(testProjectUnderTestDir, test2FileName),
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
const mockCreateAddPromise = jest.fn();
const mockCreateAddSync = jest.fn();
const testCreateAdditionalFiles = [mockCreateAddPromise, mockCreateAddSync];
const testrootDir = join(".", "pkgtests");
const testMatchIgnore = ["someglob"];

const testPkgManagerOptions: PkgManagerBaseOptions = {
	installCliArgs: "some args",
};
const testPkgManagerVersion = "3.8.2";

// Since yarn plug'n'play pollutes NODE_OPTIONS, we invalidate it in our exec scripts
const testSanitizedEnv = {
	SOME_LOCAL_KEY: "value",
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
			mockGetPkgManagerSetCommand.mockReturnValue(testPkgManagerSetCmd);
			mockGetTypescriptConfig.mockReturnValue(testTsConfig as any);
			mockGetPkgInstallCommand.mockReturnValue(testPkgInstallCmd);
			mockCp.mockResolvedValue();
			mockWriteFile.mockResolvedValue();
			mockCreateAddPromise.mockResolvedValue(["contents1", "file1.txt"]);
			mockCreateAddSync.mockResolvedValue(["contents2", "file2.txt"]);
			mockControlledExec.mockResolvedValue("stdout");
			mockSanitizeEnv.mockReturnValue(testSanitizedEnv);
			(mockTopLevelLogFilesScanner.createNested as jest.Mock).mockReturnValue(
				mockProjectLevelLogFilesScanner,
			);
			(
				mockProjectLevelLogFilesScanner.createNested as jest.Mock
			).mockReturnValue(mockPerExecLogFilesScanner);
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
			const context = {
				projectDir: testProjectUnderTestDir,
				testProjectDir,
				rootDir: testrootDir,
				matchIgnore: testMatchIgnore,
				lock: false as false,
				entryAlias: testEntryAlias,
				isCI: false,
				updateLock: false,
				config: testConfig,
				logFilesScanner: mockTopLevelLogFilesScanner,
			};
			const testOptions = {
				modType,
				pkgManager: PkgManager.YarnV1,
				additionalFiles: testAdditionalFiles,
				createAdditionalFiles: testCreateAdditionalFiles,
				pkgManagerAlias: "myalias",
				pkgManagerOptions: testPkgManagerOptions,
				pkgManagerVersion: testPkgManagerVersion,
				fileTests: {
					runWith: [RunWith.Node],
					testMatch: "some**glob",
				},
				timeout: testTimeout,
				reporter: testReporter,
			};
			const { fileTestRunners: testRunners, binTestRunner } =
				await createTestProject(context, testOptions);

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
				baseEnv: testSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
				entryAlias: testEntryAlias,
			});
			expect(binTestRunner).toBeUndefined();

			// confirm corepack use called
			expect(controlledExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: testSanitizedEnv,
				},
				expect.any(Logger),
				mockPerExecLogFilesScanner,
			);

			expect(mockCreateAddPromise).toHaveBeenCalledWith(testConfig, {
				projectDir: testProjectUnderTestDir,
				testProjectDir,
				packageManager: PkgManager.YarnV1,
				packageManagerAlias: "myalias",
				moduleType: modType,
				binTests: undefined,
				fileTests: {
					runWith: [RunWith.Node],
					testMatch: "some**glob",
				},
			});

			// confirm pkg install command called
			expect(mockPerformInstall).toHaveBeenCalledWith(
				{
					isCI: context.isCI,
					logger: expect.any(Logger),
					projectDir: context.projectDir,
					testProjectDir: context.testProjectDir,
					relPathToProject: relative(
						context.testProjectDir,
						context.projectDir,
					),
					rootDir: context.rootDir,
					updateLock: context.updateLock,
					env: testSanitizedEnv,
					entryAlias: context.entryAlias,
					logFilesScanner: mockPerExecLogFilesScanner,
				},
				{
					pkgManager: testOptions.pkgManager,
					pkgManagerAlias: testOptions.pkgManagerAlias,
					pkgManagerVersion: testOptions.pkgManagerVersion,
					modType: testOptions.modType,
					installCLiArgs: testOptions.pkgManagerOptions.installCliArgs,
					lock: false,
				},
			);

			// Confirm command retrieval functions called with versions
			expect(mockGetPkgBinaryRunnerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerSetCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
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
						scripts: {},
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
			const context = {
				projectDir: testProjectUnderTestDir,
				testProjectDir,
				rootDir: testrootDir,
				matchIgnore: testMatchIgnore,
				lock: false as false,
				entryAlias: testEntryAlias,
				isCI: false,
				updateLock: false,
				config: testConfig,
				logFilesScanner: mockTopLevelLogFilesScanner,
			};
			const testOptions = {
				modType,
				pkgManager: PkgManager.YarnV1,
				additionalFiles: testAdditionalFiles,
				createAdditionalFiles: [],
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
			};
			const { fileTestRunners: testRunners, binTestRunner } =
				await createTestProject(context, testOptions);

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
				baseEnv: testSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
				entryAlias: testEntryAlias,
			});
			expect(binTestRunner).toBeUndefined();

			// confirm corepack use called
			expect(controlledExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: testSanitizedEnv,
				},
				expect.any(Logger),
				mockPerExecLogFilesScanner,
			);

			// confirm pkg install command called
			expect(mockPerformInstall).toHaveBeenCalledWith(
				{
					isCI: context.isCI,
					logger: expect.any(Logger),
					projectDir: context.projectDir,
					testProjectDir: context.testProjectDir,
					relPathToProject: relative(
						context.testProjectDir,
						context.projectDir,
					),
					rootDir: context.rootDir,
					updateLock: context.updateLock,
					env: testSanitizedEnv,
					entryAlias: context.entryAlias,
					logFilesScanner: mockPerExecLogFilesScanner,
				},
				{
					pkgManager: testOptions.pkgManager,
					pkgManagerAlias: testOptions.pkgManagerAlias,
					pkgManagerVersion: testOptions.pkgManagerVersion,
					modType: testOptions.modType,
					installCLiArgs: testOptions.pkgManagerOptions.installCliArgs,
					lock: false,
				},
			);

			// Confirm command retrieval functions called with versions
			expect(mockGetPkgBinaryRunnerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerSetCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
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
						scripts: {},
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
			const context = {
				projectDir: testProjectUnderTestDir,
				testProjectDir,
				rootDir: testrootDir,
				matchIgnore: testMatchIgnore,
				lock: false as false,
				entryAlias: testEntryAlias,
				isCI: false,
				updateLock: false,
				config: testConfig,
				logFilesScanner: mockTopLevelLogFilesScanner,
			};
			const testOptions = {
				modType: modType,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				pkgManagerOptions: testPkgManagerOptions,
				pkgManagerVersion: testPkgManagerVersion,
				additionalFiles: testAdditionalFiles,
				createAdditionalFiles: [],
				fileTests: {
					runWith: [RunWith.Node],
					testMatch: "some**glob",
					transforms: {
						// Just providing typescript object will do
						typescript: typescriptOptions,
					},
				},
				scriptTests: [
					{
						name: "script1",
						script: "echo $something",
					},
					{
						name: "script2",
						script: "jest",
					},
				],
				timeout: testTimeout,
				reporter: testReporter,
			};
			const { fileTestRunners: testRunners, binTestRunner } =
				await createTestProject(context, testOptions);

			// confirm corepack use called
			expect(controlledExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: testSanitizedEnv,
				},
				expect.any(Logger),
				mockPerExecLogFilesScanner,
			);

			// confirm pkg install command called
			expect(mockPerformInstall).toHaveBeenCalledWith(
				{
					isCI: context.isCI,
					logger: expect.any(Logger),
					projectDir: context.projectDir,
					testProjectDir: context.testProjectDir,
					relPathToProject: relative(
						context.testProjectDir,
						context.projectDir,
					),
					rootDir: context.rootDir,
					updateLock: context.updateLock,
					env: testSanitizedEnv,
					entryAlias: context.entryAlias,
					logFilesScanner: mockPerExecLogFilesScanner,
				},
				{
					pkgManager: testOptions.pkgManager,
					pkgManagerAlias: testOptions.pkgManagerAlias,
					pkgManagerVersion: testOptions.pkgManagerVersion,
					modType: testOptions.modType,
					installCLiArgs: testOptions.pkgManagerOptions.installCliArgs,
					lock: false,
				},
			);

			// Confirm command retrieval functions called with versions
			expect(mockGetPkgBinaryRunnerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerSetCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
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
				baseEnv: testSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
				entryAlias: testEntryAlias,
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
						scripts: {
							script1: "echo $something",
							script2: "jest",
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
			expect(controlledExec).toHaveBeenCalledWith(
				`${testBinCmd} tsc -p ${expectedConfigFile}`,
				{
					cwd: testProjectDir,
					env: testSanitizedEnv,
				},
				expect.any(Logger),
				mockPerExecLogFilesScanner,
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
			const context = {
				projectDir: testProjectUnderTestDir,
				testProjectDir,
				rootDir: testrootDir,
				matchIgnore: testMatchIgnore,
				lock: false as false,
				entryAlias: testEntryAlias,
				isCI: false,
				updateLock: false,
				config: testConfig,
				logFilesScanner: mockTopLevelLogFilesScanner,
			};
			const testOptions = {
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
				createAdditionalFiles: [],
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
			};
			const { fileTestRunners: testRunners, binTestRunner } =
				await createTestProject(context, testOptions);

			// confirm corepack use called
			expect(controlledExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: testSanitizedEnv,
				},
				expect.any(Logger),
				mockPerExecLogFilesScanner,
			);

			// confirm pkg install command called
			expect(mockPerformInstall).toHaveBeenCalledWith(
				{
					isCI: context.isCI,
					logger: expect.any(Logger),
					projectDir: context.projectDir,
					testProjectDir: context.testProjectDir,
					relPathToProject: relative(
						context.testProjectDir,
						context.projectDir,
					),
					rootDir: context.rootDir,
					updateLock: context.updateLock,
					env: testSanitizedEnv,
					entryAlias: context.entryAlias,
					logFilesScanner: mockPerExecLogFilesScanner,
				},
				{
					pkgManager: testOptions.pkgManager,
					pkgManagerAlias: testOptions.pkgManagerAlias,
					pkgManagerVersion: testOptions.pkgManagerVersion,
					modType: testOptions.modType,
					installCLiArgs: testOptions.pkgManagerOptions.installCliArgs,
					lock: false,
				},
			);

			// Confirm command retrieval functions called with versions
			expect(mockGetPkgBinaryRunnerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerSetCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
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
				baseEnv: testSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
				entryAlias: testEntryAlias,
			});
			expect(binTestRunner).toEqual({
				runCommand: testBinCmd,
				projectDir: testProjectDir,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				modType: modType,
				failFast: false,
				baseEnv: testSanitizedEnv,
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
				entryAlias: testEntryAlias,
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
						scripts: {},
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
			expect(controlledExec).toHaveBeenCalledWith(
				`${testBinCmd} tsc -p ${expectedConfigFile}`,
				{
					cwd: testProjectDir,
					env: testSanitizedEnv,
				},
				expect.any(Logger),
				mockPerExecLogFilesScanner,
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
			const context = {
				projectDir: testProjectUnderTestDir,
				testProjectDir,
				rootDir: testrootDir,
				matchIgnore: testMatchIgnore,
				lock: false as false,
				entryAlias: testEntryAlias,
				isCI: false,
				updateLock: false,
				config: testConfig,
				logFilesScanner: mockTopLevelLogFilesScanner,
			};
			const testOptions = {
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
				createAdditionalFiles: [],
				fileTests: {
					runWith: allRunBy,
					testMatch: "some**glob",
					transforms: {
						typescript: typescriptOptions,
					},
				},
				timeout: testTimeout,
				reporter: testReporter,
			};
			const { fileTestRunners: testRunners, binTestRunner } =
				await createTestProject(context, testOptions);

			// confirm corepack use called
			expect(controlledExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: testSanitizedEnv,
				},
				expect.any(Logger),
				mockPerExecLogFilesScanner,
			);

			// confirm pkg install command called
			expect(mockPerformInstall).toHaveBeenCalledWith(
				{
					isCI: context.isCI,
					logger: expect.any(Logger),
					projectDir: context.projectDir,
					testProjectDir: context.testProjectDir,
					relPathToProject: relative(
						context.testProjectDir,
						context.projectDir,
					),
					rootDir: context.rootDir,
					updateLock: context.updateLock,
					env: testSanitizedEnv,
					entryAlias: context.entryAlias,
					logFilesScanner: mockPerExecLogFilesScanner,
				},
				{
					pkgManager: testOptions.pkgManager,
					pkgManagerAlias: testOptions.pkgManagerAlias,
					pkgManagerVersion: testOptions.pkgManagerVersion,
					modType: testOptions.modType,
					installCLiArgs: testOptions.pkgManagerOptions.installCliArgs,
					lock: false,
				},
			);

			// Confirm command retrieval functions called with versions
			expect(mockGetPkgBinaryRunnerCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
				testPkgManagerVersion,
			);
			expect(mockGetPkgManagerSetCommand).toHaveBeenCalledWith(
				PkgManager.YarnV1,
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
				baseEnv: testSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
				entryAlias: testEntryAlias,
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
				baseEnv: testSanitizedEnv,
				entryAlias: testEntryAlias,
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
				baseEnv: testSanitizedEnv,
				extraEnv: {},
				timeout: testTimeout,
				reporter: testReporter,
				groupOverview: expect.any(TestGroupOverview),
				entryAlias: testEntryAlias,
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
						scripts: {},
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
			expect(controlledExec).toHaveBeenCalledWith(
				`${testBinCmd} tsc -p ${expectedConfigFile}`,
				{
					cwd: testProjectDir,
					env: testSanitizedEnv,
				},
				expect.any(Logger),
				mockPerExecLogFilesScanner,
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
				config: testConfig,
				logFilesScanner: mockTopLevelLogFilesScanner,
			},
			{
				modType: ModuleTypes.Commonjs,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				pkgManagerVersion: "something",
				additionalFiles: [],
				createAdditionalFiles: [],
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
				config: testConfig,
				logFilesScanner: mockTopLevelLogFilesScanner,
			},
			{
				modType: ModuleTypes.Commonjs,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				pkgManagerVersion: "2.2.3",
				additionalFiles: [],
				createAdditionalFiles: [],
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
