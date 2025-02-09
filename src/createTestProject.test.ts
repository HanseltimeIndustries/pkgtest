import { createDependencies } from "./createDependencies";
import { getAllMatchingFiles } from "./getAllMatchingFiles";
import {
	getPkgBinaryRunnerCommand,
	getPkgManagerCommand,
	getPkgManagerSetCommand,
} from "./pkgManager";
import { getTypescriptConfig } from "./getTypescriptConfig";
import { cp, readFile, writeFile } from "fs/promises";
import { exec } from "child_process";
import {
	BUILD_DIRECTORY,
	createTestProject,
	SRC_DIRECTORY,
} from "./createTestProject";
import { ModuleTypes, PkgManager, PkgManagerBaseOptions, RunBy } from "./types";
import { join, resolve } from "path";
import { TsConfigJson } from "get-tsconfig";

jest.mock("./createDependencies");
jest.mock("fs/promises");
jest.mock("child_process");
jest.mock("./getAllMatchingFiles");
jest.mock("./pkgManager");
jest.mock("./getTypescriptConfig");
const mockCreateDependencies = jest.mocked(createDependencies);
const mockWriteFile = jest.mocked(writeFile);
const mockCp = jest.mocked(cp);
const mockExec = jest.mocked(exec);
const mockGetAllMatchingFiles = jest.mocked(getAllMatchingFiles);
const mockGetPkgManagerCommand = jest.mocked(getPkgManagerCommand);
const mockGetPkgBinaryRunnerCommand = jest.mocked(getPkgBinaryRunnerCommand);
const mockGetPkgManagerSetCommand = jest.mocked(getPkgManagerSetCommand);
const mockGetTypescriptConfig = jest.mocked(getTypescriptConfig);
const mockReadFile = jest.mocked(readFile);

const testBinCmd = "corepack npx@latest";
const testPkgManagerCmd = "corepack npm@latest";
const testPkgManagerSetCmd = "corepack use npm@latest";
const testDeps = {
	dep1: "1.0.1",
	dep2: "^2.0.1",
};
const projectUnderTestDirName = "packageUnderTest";
const testProjectUnderTestDir = resolve(process.cwd(), projectUnderTestDirName);
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
const testAdditionalDeps = {
	addDep: "3.0.0",
};
const testMatchRootDir = "./pkgtests";
const testMatchIgnore = ["someglob"];

const testPkgManagerOptions: PkgManagerBaseOptions = {
	installCliArgs: "some args",
};
const testPkgManagerVersion = "3.8.2";

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
			const testProjectDir = resolve(
				process.cwd(),
				"someNesting",
				"testProjectDir",
			);
			const expectedRelativeInstallPath = join(
				"..",
				"..",
				projectUnderTestDirName,
			); // Since the the package under test dir at cwd + dir
			const testRunners = await createTestProject(
				{
					projectDir: testProjectUnderTestDir,
					testProjectDir,
					matchRootDir: testMatchRootDir,
					matchIgnore: testMatchIgnore,
				},
				{
					runBy: [RunBy.Node],
					modType,
					pkgManager: PkgManager.YarnV1,
					pkgManagerAlias: "myalias",
					pkgManagerOptions: testPkgManagerOptions,
					pkgManagerVersion: testPkgManagerVersion,
					testMatch: "some**glob",
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
				runCommand: `${testBinCmd} ${RunBy.Node}`,
				runBy: RunBy.Node,
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
				extraEnv: {},
			});

			// confirm corepack use called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: process.env,
				},
				expect.anything(),
			);

			// confirm pkg install command called
			expect(mockExec).toHaveBeenCalledWith(
				`${testPkgManagerCmd} install ${testPkgManagerOptions.installCliArgs}`,
				{
					cwd: testProjectDir,
					env: process.env,
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

			// Confirm correct function calls to mocks
			expect(mockCreateDependencies).toHaveBeenCalledWith(
				testPackageJson,
				expectedRelativeInstallPath,
				{
					runBy: [RunBy.Node],
					pkgManager: PkgManager.YarnV1,
					// No typescript options provided
				},
			);
			expect(mockWriteFile).toHaveBeenCalledWith(
				join(testProjectDir, "package.json"),
				JSON.stringify(
					{
						name: `@dummy-test-package/test-${modType}`,
						description: `Compiled tests for ${testPackageJson.name} as ${modType} project import`,
						...expectedTypeField,
						// These were populated by the createDependencies method we mocked
						dependencies: {
							...testDeps,
						},
						private: true,
					},
					null,
					4,
				),
			);
			expect(mockGetAllMatchingFiles).toHaveBeenCalledWith(
				resolve(testProjectUnderTestDir, testMatchRootDir),
				"some**glob",
				testMatchIgnore,
			);
			for (const { copiedTo, from } of expectedCopyOver) {
				expect(mockCp).toHaveBeenCalledWith(from, copiedTo);
			}
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
			const testProjectDir = resolve(
				process.cwd(),
				"someNesting",
				"testProjectDir",
			);
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
			const testRunners = await createTestProject(
				{
					projectDir: testProjectUnderTestDir,
					testProjectDir,
					matchRootDir: testMatchRootDir,
					matchIgnore: testMatchIgnore,
				},
				{
					runBy: [RunBy.Node],
					modType: modType,
					pkgManager: PkgManager.YarnV1,
					pkgManagerAlias: "myalias",
					pkgManagerOptions: testPkgManagerOptions,
					pkgManagerVersion: testPkgManagerVersion,
					testMatch: "some**glob",
					// Just providing typescript object will do
					typescript: typescriptOptions,
				},
			);

			// confirm corepack use called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: process.env,
				},
				expect.anything(),
			);

			// confirm pkg install command called
			expect(mockExec).toHaveBeenCalledWith(
				`${testPkgManagerCmd} install ${testPkgManagerOptions.installCliArgs}`,
				{
					cwd: testProjectDir,
					env: process.env,
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
				runCommand: `${testBinCmd} ${RunBy.Node}`,
				runBy: RunBy.Node,
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
				extraEnv: {},
			});

			// Confirm correct function calls to mocks
			expect(mockCreateDependencies).toHaveBeenCalledWith(
				testPackageJson,
				expectedRelativeInstallPath,
				{
					runBy: [RunBy.Node],
					pkgManager: PkgManager.YarnV1,
					typescript: typescriptOptions,
				},
			);
			expect(mockWriteFile).toHaveBeenCalledWith(
				join(testProjectDir, "package.json"),
				JSON.stringify(
					{
						name: `@dummy-test-package/test-${modType}`,
						description: `Compiled tests for ${testPackageJson.name} as ${modType} project import`,
						...expectedTypeField,
						// These were populated by the createDependencies method we mocked
						dependencies: {
							...testDeps,
						},
						private: true,
					},
					null,
					4,
				),
			);
			expect(mockGetAllMatchingFiles).toHaveBeenCalledWith(
				resolve(testProjectUnderTestDir, testMatchRootDir),
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
					env: process.env,
				},
				expect.anything(), // callback
			);
		});

		const allRunBy = Object.values(RunBy);
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
			const testProjectDir = resolve(
				process.cwd(),
				"someNesting",
				"testProjectDir",
			);
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
			const testRunners = await createTestProject(
				{
					projectDir: testProjectUnderTestDir,
					testProjectDir,
					matchRootDir: testMatchRootDir,
					matchIgnore: testMatchIgnore,
				},
				{
					runBy: allRunBy,
					modType,
					pkgManager: PkgManager.YarnV1,
					pkgManagerAlias: "myalias",
					pkgManagerOptions: testPkgManagerOptions,
					pkgManagerVersion: testPkgManagerVersion,
					testMatch: "some**glob",
					// Just providing typescript object will do
					typescript: typescriptOptions,
					additionalDependencies: testAdditionalDeps,
				},
			);

			// confirm corepack use called
			expect(mockExec).toHaveBeenCalledWith(
				testPkgManagerSetCmd,
				{
					cwd: testProjectDir,
					env: process.env,
				},
				expect.anything(),
			);

			// confirm pkg install command called
			expect(mockExec).toHaveBeenCalledWith(
				`${testPkgManagerCmd} install ${testPkgManagerOptions.installCliArgs}`,
				{
					cwd: testProjectDir,
					env: process.env,
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
			expect(testRunners).toHaveLength(Object.values(RunBy).length);
			expect(testRunners).toContainEqual({
				runCommand: `${testBinCmd} ${RunBy.Node}`,
				runBy: RunBy.Node,
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
				extraEnv: {},
			});
			expect(testRunners).toContainEqual({
				// Since Ts-node doesn't really work the same with esm, the command changes
				runCommand:
					modType === ModuleTypes.Commonjs
						? `${testBinCmd} ts-node --project ${expectedConfigFile}`
						: `${testBinCmd} node --loader ts-node/esm`,
				runBy: RunBy.TsNode,
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
				extraEnv:
					modType === ModuleTypes.Commonjs
						? {}
						: {
								TS_NODE_PROJECT: expectedConfigFile,
							},
			});
			expect(testRunners).toContainEqual({
				runCommand: `${testBinCmd} tsx --tsconfig ${expectedConfigFile}`,
				runBy: RunBy.Tsx,
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
				extraEnv: {},
			});

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
						description: `Compiled tests for ${testPackageJson.name} as ${modType} project import`,
						...expectedTypeField,
						// These were populated by the createDependencies method we mocked
						dependencies: {
							...testDeps,
						},
						private: true,
					},
					null,
					4,
				),
			);
			expect(mockGetAllMatchingFiles).toHaveBeenCalledWith(
				resolve(testProjectUnderTestDir, testMatchRootDir),
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
					env: process.env,
				},
				expect.anything(), // callback
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
				matchRootDir: testMatchRootDir,
				matchIgnore: testMatchIgnore,
			},
			{
				runBy: [RunBy.Node],
				modType: ModuleTypes.Commonjs,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				testMatch: "some**glob",
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
				matchRootDir: testMatchRootDir,
				matchIgnore: testMatchIgnore,
			},
			{
				runBy: [RunBy.Node],
				modType: ModuleTypes.Commonjs,
				pkgManager: PkgManager.YarnV1,
				pkgManagerAlias: "myalias",
				testMatch: "some**glob",
			},
		);
	}).rejects.toThrow("testProjectDir must be absolute path!");
});
