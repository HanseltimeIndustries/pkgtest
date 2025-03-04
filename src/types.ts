import type { TsConfigJson } from "get-tsconfig";
import { CreateDependenciesOptions } from "./createDependencies";
import type { PackageJson } from "type-fest";

/**
 * The type of module that the testing package will be created as:
 *
 * i.e. { "type": "module" } in package.json for "esm"
 */
export enum ModuleTypes {
	Commonjs = "commonjs",
	ESM = "esm",
}

/**
 * The different ways that we run the test files
 */
export enum RunWith {
	/**
	 * This only works with .js files or files that are transformed to a js file first
	 */
	Node = "node",
	/**
	 * This will run ts-node [script.ts]
	 */
	TsNode = "ts-node",
	/**
	 * This will run via tsx [script.ts]
	 */
	Tsx = "tsx",
}

export enum PkgManager {
	Npm = "npm",
	Pnpm = "pnpm",
	YarnV1 = "yarn-v1",
	/**
	 * Yarn >1.x - this is referred to by the yarn project as yarn berry
	 */
	YarnBerry = "yarn-berry",
}

export enum TestType {
	/**
	 * Represents a test that we are going to call node or some node equivalent on a source file
	 */
	File = "file",
	/**
	 * Represents a test where we are actually going to call one of the declared bin's in the package
	 * that we're testing
	 */
	Bin = "bin",
	/**
	 * Represents a test where we call a script that we inserted into each test project's package.json.
	 * This is ideal for plugin type packages:
	 *
	 * i.e. writing a jest matcher and then running your pkgtest to call "jestTest": "jest" with an appropriate
	 * config file that has tests that use the matcher.
	 */
	Script = "script",
}

export interface InstalledTool {
	/**
	 * Explicit version to test.  If not supplied, we will use the
	 * dependency/devDependency of the testing project or throw an error if we can't find anything
	 */
	version?: string;
}
export interface TsNodeRun extends InstalledTool {}

export interface TsxRun extends InstalledTool {}

export interface TypescriptOptions extends InstalledTool {
	/**
	 * Typescript configuration that is merged with the base typescript that is created
	 */
	config?: Partial<TsConfigJson>;
	/**
	 * The version of the @types/node
	 */
	nodeTypes?: InstalledTool;
	/**
	 * Required if Tsx is included in the runBy section
	 */
	tsx?: TsxRun;
	/**
	 * Required if ts-node is included in the runBy section
	 */
	tsNode?: TsNodeRun;
}

export interface PkgManagerBaseOptions {
	/**
	 * The cli arguments to add to the install command
	 */
	installCliArgs?: string;
}

export interface YarnV4Options extends PkgManagerBaseOptions {
	/**
	 * If provided, any .yarnrc.yml properties that you would like to specify
	 *
	 * https://yarnpkg.com/configuration/yarnrc
	 *
	 * The most common of these would be nodeLinker so you can verify non-plug'n'play functionality
	 */
	yarnrc?: any;
}

/**
 * Type switch for different options configurations per package manager
 */
export type PkgManagerOptions<T extends PkgManager> =
	T extends PkgManager.YarnBerry ? YarnV4Options : PkgManagerBaseOptions;

/**
 * More complex package manager configuration where supported properties per package
 * manager are available to create variants of a singular package manager based project
 * (like yarn has plug'n'play, node_modules, and pnpm linker functions)
 */
export interface PkgManagerOptionsConfig<T extends PkgManager> {
	packageManager: T;
	/**
	 * For test suite identification, this will provide an alias for the configuration in the event that
	 * multiple of the same package manager are used
	 */
	alias: string;
	/**
	 * The version of the package manager to use (installed via corepack)
	 *
	 * Defaults to latest if not supplied
	 */
	version?: string;
	options?: PkgManagerOptions<T>;
}

/**
 * This can either be an absolute path to anywhere, a relative path (relative to the rootDir of pkgtest)
 *
 * Directories will be copied recursively
 */
export type AddFileMatch = string;
/**
 * A context object for create additional file lambdas
 */
export interface CreateTestProjectInfo {
	/**
	 * The path of the current test project that is being created
	 */
	testProjectDir: string;
	/**
	 * The path of the project under test
	 */
	projectDir: string;
	packageManager: PkgManager;
	packageManagerAlias: string;
	moduleType: ModuleTypes;
	fileTests?: FileTestConfig;
	binTests?: BinTestConfig;
}

/**
 * In the event that you need to do some more programmatic generation of files, you can provide a function
 * that will be invoked at the end of setting up the project.  This will provide file contents and the
 * relative file name that will be placed in the test project.
 *
 * @param {TestConfig} config - This is the entire test config object that this function is found in
 * @param {TestConfigEntry} projectInfo - If this is part of a test entry, then project info describing the current
 * 			test project that is being created will be provided
 * @returns {[string, string]} returns the file contents in the first spot and then the name of the file relative
 *          to the test project directory.
 */
export type AddFilePerTestProjectCreate = (
	config: TestConfig,
	projectInfo: CreateTestProjectInfo,
) => Promise<[string, string]> | [string, string];
/**
 * A path that is set up relative to the test project directory where this file will be copied (same name)
 */
export type ToDir = string;
/**
 * Specifies exactly where within the project directory that we want to copy the files provided
 */
export type AddFileCopyTo = [AddFileMatch, ToDir];
/**
 * If you just supply a string as an entry, then the file/files will be copied to the root of the test project.
 *
 * If you provide your own to directory, then all files will be copied relative to that directory.
 */
export type AdditionalFilesEntry = AddFileMatch | [AddFileMatch, ToDir];

export interface BinTestEntry {
	/**
	 * A string of args to add after the call
	 */
	args: string;
	/**
	 * Any environment variables to set for this particular test
	 */
	env?: Record<string, string>;
}

/**
 * Note: if the object is empty, then `--help` will be called on every found bin command
 */
export interface BinTestConfig {
	/**
	 * Per named bin command in your package.json, you can add a key to override cli calls that we run
	 * to test.
	 *
	 * Each array entry creates a new test of the binary.
	 */
	[binCmd: string]: BinTestEntry[];
}

export interface FileTestConfig {
	/**
	 * A glob patterned string from the cwd (the package root) that will identify any pkgTest files to copy into
	 * respective package tests and then run.
	 */
	testMatch: string;
	/**
	 * The various ways that you want to run the scripts in question to verify they work as expected.
	 * Note, we will run each way per package manager + module project that is created.
	 */
	runWith: RunWith[];
	/**
	 * Transforms that need to be run on the raw tests that were found via testMatch and copied into the project.
	 *
	 * If none are provided, then you can only use runWith tools that can operate directly on js and we expect
	 * the files to be in the correct raw js flavor
	 */
	transforms?: {
		typescript: TypescriptOptions;
	};
}

/**
 * A Script test involves declaring a set of scripts that will be run in the testProject and evaluated to see if they're true
 *
 * They will ultimately be run by <package manager> <script>
 */
export interface ScriptTestConfig {
	name: string;
	script: string;
}

export interface TestConfigEntry {
	fileTests?: FileTestConfig;
	/**
	 * If you would like a test suite per test project that injects the given scripts into the packge.json and runs them
	 * in sequence, evaluating each for a zero exit code
	 */
	scriptTests?: ScriptTestConfig[];
	/**
	 * Which package managed we will use to install dependencies and run the various test scripts provided.
	 *
	 * Important - to preserve integrity during testing, each module type will get a brand new project per package
	 * manager to avoid dependency install and access issues.
	 */
	packageManagers: (PkgManager | PkgManagerOptionsConfig<PkgManager>)[];
	/**
	 * A list of module types that we will import the package under test with.  If you are using typescript,
	 * you will probably want the same configuration for both moduleTypes and will only need one TetsConfigEntry
	 * for both.
	 *
	 * If you are writing in raw JS though, you will more than likely need to keep ESM and CommonJS equivalent versions
	 * of each package test and therefore will need to have an entry with ["commonjs"] and ["esm"] separately so that
	 * you can change the testMatch to pick the correct files.
	 */
	moduleTypes: ModuleTypes[];
	/**
	 * Additional dependencies that can't be inferred from the project's package.json
	 * or other explicit fields like "typescript.tsx.version".
	 */
	additionalDependencies?: CreateDependenciesOptions["additionalDependencies"];
	/**
	 * If this is provided, this will also generate a test per package manager + module type combination
	 * where each bin command provided is called accordingly
	 *
	 * By default, if you provide an empty object, all commands will be run with --help
	 */
	binTests?: BinTestConfig;
	/**
	 * If you would like to place additional files within the test projects
	 */
	additionalFiles?: (AdditionalFilesEntry | AddFilePerTestProjectCreate)[];
	/**
	 * Number of milliseconds per test to allow before failing
	 */
	timeout?: number;
	/**
	 * This will override the test Project PackageJson with the specific values
	 */
	packageJson?: Omit<PackageJson, "name">;
}

export interface TestConfig {
	/**
	 * The directory that we will match our globs against.  This path is relative to the directory with the pkgtest.config file.
	 *
	 * @default "./"
	 */
	rootDir?: string;
	/**
	 * A string of globs to ignore when searching for file test matches.  This is helpful for performance by ensuring that we skip scanning large
	 * directories like node_modules.
	 *
	 * Keep in mind that this glob is relative to rootDir.
	 *
	 * (As a matter of performance, we don't scan node_modules, .yarn, or .git)
	 */
	matchIgnore?: string[];
	/**
	 * Logical unit separating out what test files should be run and under what conditions.
	 */
	entries: TestConfigEntry[];
	/**
	 * This will override the test Project PackageJson with the specific values
	 */
	packageJson?: Omit<PackageJson, "name">;
	/**
	 * Additional dependencies that can't be inferred from the project's package.json
	 * or other explicit fields like "typescript.tsx.version".
	 */
	additionalDependencies?: CreateDependenciesOptions["additionalDependencies"];
	/**
	 * If you would like to place additional files within the test projects
	 */
	additionalFiles?: AdditionalFilesEntry[];
	/**
	 * Behavior for package locks
	 */
	locks:
		| {
				folder: string;
		  }
		| boolean;
}

/**
 * Simple error to indicate controlled failures of a test internally
 */
export class TestFailError extends Error {}

export class FailFastError extends Error {}

/// Log Files Collection Types

/**
 * Different stages that we can isolate and scan for log collection
 *
 * This is important because finding log files involves pkgtest scanning
 * all stdio of every exec command that runs and using a regex to find log files.
 *
 * Then at the end of that scan, it will copy those log files over to the log collection
 * folder.  This is valuable for ephemeral systems that you can't exec into but will slow
 * down anything that does not need it.
 */
export enum CollectLogFileStages {
	None = "none",
	/**
	 * All setup exec calls from corepack installation to pkgmanager installation
	 */
	Setup = "setup",
	/**
	 * All test runs will be scanned
	 *
	 * Note: this takes precednece over file tests if both specified
	 */
	Tests = "tests",
	/**
	 * Just file tests
	 */
	FileTests = "file",
	/**
	 * Just bin tests
	 */
	BinTests = "bin",
	/**
	 * Just script tests
	 */
	ScriptTests = "script",
	/**
	 * All stages - this will take precedence over any other stages
	 */
	All = "all",
}

/**
 * Since pkgtest is scanning all stdio from exec processes when collecting log files,
 * it is important to be able to limit when that scanning and saving happens.
 *
 * It is generally recommended to use "Error" when collecting log files so that you
 * can find logs related to failed processes while minimizing the extra computation that
 * occurs.
 */
export enum CollectLogFilesOn {
	/**
	 * Only if the exec process that we're monitoring did a non-zero exit
	 */
	Error = "error",
	/**
	 * Stdout and stderr will be scanned and collected regardless of exit code
	 */
	All = "all",
}

/**
 * Since windows has some historical installation problems with local packages,
 * this says what to do if the platform is windows and we encounter a test project
 * that would be problematic.
 */
export enum OnWindowsProblemsAction {
	/**
	 * This will just leave a notice in the stdout and skip the test as if it was filtered
	 */
	Skip = "skip",
	/**
	 * This will throw an error to let you know that this test would be run and is problematic.
	 * This is good if you want to keep a dynamic pkgtest.config.js file where you actively
	 * don't provide configurations for problematic tests.
	 */
	Error = "error",
}
