import { TsConfigJson } from "get-tsconfig";
import { CreateDependenciesOptions } from "./createDependencies";

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
	options: PkgManagerOptions<T>;
}

/**
 * This can either be an absolute path to anywhere, a relative path (relative to the rootDir of pkgtest)
 *
 * Directories will be copied recursively
 */
export type AddFileMatch = string;
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

export interface TestConfigEntry {
	fileTests?: FileTestConfig;
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
	additionalFiles?: AdditionalFilesEntry[];
	/**
	 * Number of milliseconds per test to allow before failing
	 */
	timeout?: number;
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
	 * Additional dependencies that can't be inferred from the project's package.json
	 * or other explicit fields like "typescript.tsx.version".
	 */
	additionalDependencies?: CreateDependenciesOptions["additionalDependencies"];
	/**
	 * If you would like to place additional files within the test projects
	 */
	additionalFiles?: AdditionalFilesEntry[];
}

/**
 * Simple error to indicate controlled failures of a test internally
 */
export class TestFailError extends Error {}

export class FailFastError extends Error {}
