import { TsConfigJson } from "get-tsconfig";

/**
 * The type of module that the testing package that is created will be listed as:
 *
 * i.e. "type": "module" for esm
 */
export enum ModuleTypes {
	Commonjs = "commonjs",
	ESM = "esm",
}

/**
 * The different ways that we run the test files
 */
export enum RunBy {
	/**
	 * This only works with .js files or files that are transformed to a js file first
	 */
	Node = "node",
	/**
	 * This will run ts-node <script>.ts
	 */
	TsNode = "ts-node",
	/**
	 * This will run via tsx <script>.ts
	 */
	Tsx = "tsx",
}

export enum PkgManager {
	Npm = "npm",
	Pnpm = "pnpm",
	YarnV1 = "yarn-v1",
	YarnBerry = "yarn-berry",
}

export enum YarnMode {
	Pnpm = "pnpm",
	NodeModules = "node_modules",
	pnp = "pnp",
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
	/**
	 * The version of the package manager to use (installed via corepack)
	 *
	 * Defaults to latest if not supplied
	 */
	version?: string;
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
export interface PktManagerOptionsConfig<T extends PkgManager> {
	packageManager: T;
	/**
	 * For test suite identification, this will provide an alias for the configuration in the event that
	 * multiple of the same package manager are used
	 */
	alias: string;
	options: PkgManagerOptions<T>;
}

export interface TestConfigEntry {
	/**
	 * A glob patterned string from the cwd (the package root) that will identify any pkgTest files to copy into
	 * respective package tests and then run.
	 */
	testMatch: string;
	/**
	 * Which package managed we will use to install dependencies and run the various test scripts provided.
	 *
	 * Important - to preserve integrity during testing, each module type will get a brand new project per package
	 * manager to avoid dependency install and access issues.
	 */
	packageManagers: (PkgManager | PktManagerOptionsConfig<PkgManager>)[];

	/**
	 * The various ways that you want to run the scripts in question to verify they work as expected.
	 * Note, we will run each way per package manager + module project that is created.
	 */
	runWith: RunBy[];
	/**
	 * Transforms that need to be run on the raw tests that were found via testMatch and copied into the project.
	 *
	 * If none are provided, then you can only use runWith tools that can operate directly on js and we expect
	 * the files to be in the correct raw js flavor
	 */
	transforms: {
		typescript: TypescriptOptions;
	};
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
	additionalDependencies?: {
		[pkg: string]: string;
	};
}

export interface TestConfig {
	entries: TestConfigEntry[];
}
