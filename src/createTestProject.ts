import { cp, readFile, writeFile } from "fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "path";
import { getAllMatchingFiles } from "./files";
import {
	ModuleTypes,
	PkgManager,
	RunWith,
	PkgManagerOptions,
	YarnV4Options,
	BinTestConfig,
	FileTestConfig,
	AddFilePerTestProjectCreate,
	ScriptTestConfig,
} from "./types";
import { getTypescriptConfig } from "./getTypescriptConfig";
import { createDependencies } from "./createDependencies";
import {
	getPkgBinaryRunnerCommand,
	getPkgManagerSetCommand,
	getPkgScriptRunnerCommand,
	sanitizeEnv,
} from "./pkgManager";
import { BinTestRunner, FileTestRunner, ScriptTestRunner } from "./runners";
import * as yaml from "js-yaml";
import { Logger } from "./Logger";
import { copyOverAdditionalFiles } from "./files";
import { AdditionalFilesCopy } from "./files/types";
import { Reporter, TestFile } from "./reporters";
import { PackageJson } from "type-fest";
import { controlledExec } from "./controlledExec";
import { performInstall } from "./performInstall";
import { StandardizedTestConfig } from "./config";
import { existsSync } from "fs";

export const SRC_DIRECTORY = "src";
export const BUILD_DIRECTORY = "dist";

export interface CreateTestProjectContext {
	/**
	 * Absolute path to the project under test directory
	 */
	projectDir: string;
	/**
	 * The relative path from the projectDir to look for tests.  This affects testMatch
	 *
	 * This defaults to ./
	 */
	rootDir: string;
	/**
	 * An alias string to track which entry is calling this (used for installation lock storage)
	 */
	entryAlias: string;
	isCI: boolean;
	/**
	 * Whether or not there is a context that we want to load lockfiles to
	 */
	lock:
		| false
		| {
				folder: string;
		  };
	updateLock: boolean;
	/**
	 * For each glob pattern, this will not even bother looking for tests inside of it.
	 *
	 * This is ideal for folders that just eat up performance by having pkgtest look through it
	 * even though there's no tests (node_modules anyone?)
	 */
	matchIgnore: string[];
	/**
	 * Absolute path to the directory we created for temporary testing
	 */
	testProjectDir: string;
	debug?: boolean;
	failFast?: boolean;
	/**
	 * JUST USED FOR LAMBDA CALLS
	 */
	config: StandardizedTestConfig;
}

export interface CreateTestTestOptions<PkgManagerT extends PkgManager> {
	modType: ModuleTypes;
	pkgManager: PkgManagerT;
	/**
	 * At this point, package manager version should be a fixed non-latest string
	 */
	pkgManagerVersion: string;
	/**
	 * The alias for the pkgmanager + options configuration - used for test differentiation
	 */
	pkgManagerAlias: string;
	/**
	 * If an advanced configuration was used, this is the package manager options for the specific manager
	 * (set up before installing)
	 */
	pkgManagerOptions?: PkgManagerOptions<PkgManagerT>;
	packageJson?: PackageJson;
	binTests?: BinTestConfig;
	scriptTests?: ScriptTestConfig[];
	fileTests?: FileTestConfig;
	/**
	 * Any additional files that we want to copy into the project directory
	 */
	additionalFiles: AdditionalFilesCopy[];
	createAdditionalFiles: AddFilePerTestProjectCreate[];
	/**
	 * The number of ms that any test is allowed to run
	 */
	timeout: number;

	reporter: Reporter;
}

/**
 * Creates a test project (the physical package.json folder) for a given configuration
 * and then returns the different TestRunners that represent a unit of tests that are run the
 * same way.
 *
 * @param context
 * @param testOptions
 * @returns
 */
export async function createTestProject<PkgManagerT extends PkgManager>(
	context: CreateTestProjectContext,
	testOptions: CreateTestTestOptions<PkgManagerT>,
): Promise<{
	fileTestRunners: FileTestRunner[];
	binTestRunner?: BinTestRunner;
	scriptTestRunner?: ScriptTestRunner;
}> {
	const {
		projectDir,
		testProjectDir,
		debug,
		failFast,
		rootDir,
		matchIgnore,
		lock,
	} = context;

	if (!isAbsolute(projectDir)) {
		throw new Error("projectDir must be absolute path!");
	}
	if (!isAbsolute(testProjectDir)) {
		throw new Error("testProjectDir must be absolute path!");
	}

	const {
		modType,
		pkgManager,
		pkgManagerOptions,
		pkgManagerAlias,
		pkgManagerVersion,
		fileTests,
		additionalFiles,
		createAdditionalFiles,
		timeout,
		reporter,
		packageJson: packageJsonOverrides,
		scriptTests,
	} = testOptions;
	const logPrefix = `[${context.entryAlias}, ${pkgManager}, ${pkgManagerAlias}, ${modType}, @${testProjectDir}]`;

	let testFiles: string[] = [];
	if (fileTests) {
		testFiles = await getAllMatchingFiles(
			resolve(projectDir, rootDir),
			fileTests.testMatch,
			matchIgnore,
		);
		if (testFiles.length == 0) {
			throw new Error(`Cannot find any tests to match: ${fileTests.testMatch}`);
		}
	}
	const logger = new Logger({
		context: logPrefix,
		debug: !!debug,
	});

	logger.logDebug(`Generating package.json at ${testProjectDir}`);

	const unnormalizedRelativePath = relative(testProjectDir, projectDir);
	const relativePath = unnormalizedRelativePath;
	// process.platform === "win32"
	// 	? "/" + unnormalizedRelativePath.replaceAll("\\", "/")
	// 	: unnormalizedRelativePath;
	const packageJson = JSON.parse(
		(await readFile(join(projectDir, "package.json"))).toString(),
	) as {
		name: string;
		dependencies?: {
			[pkg: string]: string;
		};
		devDependencies?: {
			[pkg: string]: string;
		};
		peerDependencies?: {
			[pkg: string]: string;
		};
		bin?:
			| string
			| {
					[cmd: string]: string;
			  };
	};

	// Add the module type of the test package
	const typeProps: {
		type?: "module";
	} = {};
	switch (modType) {
		case "esm":
			typeProps["type"] = "module";
			break;
		case "commonjs":
			break;
		default:
			throw new Error("Unimplemented module type: " + modType);
	}

	// Forbid some package json fields
	if (packageJsonOverrides) {
		if (packageJsonOverrides.type) {
			throw new Error(
				`Pacakge.json overrides shoudl not include 'module' type as that is set by pkgtest`,
			);
		}
	}
	// We want to infer installs but also respect any devDeps explicitly added,
	// Since maybe the script scans for devDeps, etc.
	const explictDevDeps = packageJsonOverrides?.devDependencies ?? {};
	const dependencies = createDependencies(packageJson, relativePath, {
		pkgManager: testOptions.pkgManager,
		runBy: fileTests?.runWith,
		typescript: fileTests?.transforms?.typescript,
		additionalDependencies: {
			...((packageJsonOverrides?.dependencies ?? {}) as {
				[k: string]: string;
			}),
		},
	});
	Object.keys(explictDevDeps).forEach((dep) => {
		delete dependencies[dep];
	});

	const pkgJson = {
		name: `@dummy-test-package/test-${modType}`,
		version: "0.0.0",
		description: `Compiled tests for ${packageJson.name} as ${modType} project import`,
		...typeProps,
		private: true,
		...packageJsonOverrides,
		dependencies,
		scripts: {
			...packageJsonOverrides?.scripts,
			...scriptTests?.reduce(
				(scripts, sT) => {
					scripts[sT.name] = sT.script;
					return scripts;
				},
				{} as {
					[s: string]: string;
				},
			),
		},
	};
	// Write the package.json to the directory
	await writeFile(
		join(testProjectDir, "package.json"),
		JSON.stringify(pkgJson, null, 4),
	);
	logger.logDebug(`Finished writing package.json at ${testProjectDir}`);

	logger.logDebug(`Running package installation at ${testProjectDir}`);
	// depending on the type of package manager - perform installs
	const installCLiArgs = pkgManagerOptions?.installCliArgs ?? "";
	// Pre-install setup
	if (pkgManager === PkgManager.YarnBerry) {
		const cast = pkgManagerOptions as YarnV4Options;
		if (cast?.yarnrc) {
			logger.logDebug(`Writing .yarnrc.yml at ${testProjectDir}`);
			await writeFile(
				join(testProjectDir, ".yarnrc.yml"),
				yaml.dump(cast.yarnrc),
			);
		}
	}
	const sanitizedEnv = sanitizeEnv(resolve(testProjectDir, "package.json"));
	await controlledExec(
		getPkgManagerSetCommand(pkgManager, pkgManagerVersion),
		{
			cwd: testProjectDir,
			env: sanitizedEnv,
		},
		logger,
	);
	await performInstall(
		{
			isCI: context.isCI,
			logger,
			projectDir: context.projectDir,
			testProjectDir: context.testProjectDir,
			relPathToProject: relativePath,
			rootDir: context.rootDir,
			updateLock: context.updateLock,
			env: sanitizedEnv,
			entryAlias: context.entryAlias,
		},
		{
			pkgManager,
			pkgManagerAlias,
			pkgManagerVersion,
			modType,
			installCLiArgs,
			lock,
		},
	);
	logger.logDebug(`Finished installation (${pkgManager}) at ${testProjectDir}`);

	const fileTestRunners: FileTestRunner[] = [];
	const binRunCmd = getPkgBinaryRunnerCommand(pkgManager, pkgManagerVersion);

	// Create fileTests if necessary
	if (fileTests) {
		const absSrcPath = join(testProjectDir, SRC_DIRECTORY);

		logger.logDebug(`Copying ${testFiles.length} test files to ${absSrcPath}`);

		// Copy over the test files to the project directory
		const normalizeProjectDir = projectDir.endsWith(sep)
			? projectDir
			: projectDir + sep;
		const copiedTestFiles = await Promise.all(
			testFiles.map(async (tf) => {
				const copiedTestFile = tf.replace(projectDir, absSrcPath);
				await cp(tf, copiedTestFile);
				return {
					// Normalize it to avoid globs matching upstream folders, etc.
					orig: tf.replace(normalizeProjectDir, ""),
					actual: copiedTestFile,
				};
			}),
		);

		logger.logDebug(`Finished copying test files to ${absSrcPath}`);

		// Add a tsconfig file if we are using typescript transpilation
		if (fileTests.transforms?.typescript) {
			const configFilePath = `tsconfig.${modType}.json`;
			logger.logDebug(`Creating ${configFilePath} at ${testProjectDir}`);
			const tsConfig = getTypescriptConfig(
				{
					modType,
					tsBuildDir: BUILD_DIRECTORY,
					tsSrcDir: SRC_DIRECTORY,
				},
				fileTests.transforms.typescript,
			);
			await writeFile(
				join(testProjectDir, configFilePath),
				JSON.stringify(tsConfig, null, 4),
			);
			logger.logDebug(`Created ${configFilePath} at ${testProjectDir}`);

			logger.logDebug(`Compiling ${configFilePath} at ${testProjectDir}`);

			// Transpile the typescript projects
			await controlledExec(
				`${binRunCmd} tsc -p ${configFilePath}`,
				{
					cwd: testProjectDir,
					env: sanitizedEnv,
				},
				logger,
			);
			logger.logDebug(`Compiled ${configFilePath} at ${testProjectDir}`);

			const absBuildPath = join(
				testProjectDir,
				tsConfig.compilerOptions.outDir,
			);

			let runCommand: string;
			fileTests.runWith.forEach((rBy) => {
				let testFiles: TestFile[];
				let additionalArgs: string = "";
				let additionalEnv: {
					[env: string]: string;
				} = {};
				switch (rBy) {
					case RunWith.Node:
						testFiles = copiedTestFiles.map(({ orig, actual }) => {
							// Since ts builds to .js we also need to replace the extensions
							return {
								orig,
								actual: actual
									.replace(absSrcPath, absBuildPath)
									.replace(/\.tsx?$/, ".js"),
							};
						});
						additionalArgs = "";
						runCommand = rBy;
						break;
					case RunWith.TsNode:
						testFiles = copiedTestFiles;
						// ts-node and esm do not play well.  This is the most stable config I know of
						if (modType === ModuleTypes.ESM) {
							runCommand = "node --loader ts-node/esm";
							if (pkgManager === PkgManager.YarnBerry) {
								if (existsSync(join(testProjectDir, ".pnp.loader.mjs"))) {
									// Yarn plug'n'play requires us to also specify its loader
									runCommand += " --loader ./.pnp.loader.mjs";
								}
							}
							additionalEnv.TS_NODE_PROJECT = configFilePath;
						} else {
							runCommand = rBy;
							additionalArgs = `--project ${configFilePath}`;
						}
						break;
					case RunWith.Tsx:
						testFiles = copiedTestFiles;
						additionalArgs = `--tsconfig ${configFilePath}`;
						runCommand = rBy;
						break;
					default:
						throw new Error(
							`Unimplemented testFile mapping for ${rBy} and typescript configuration!`,
						);
				}
				fileTestRunners.push(
					new FileTestRunner({
						projectDir: testProjectDir,
						runCommand: `${binRunCmd} ${runCommand}${additionalArgs ? " " + additionalArgs : ""}`,
						testFiles,
						runBy: rBy,
						pkgManager,
						pkgManagerAlias,
						modType,
						failFast,
						extraEnv: additionalEnv,
						timeout,
						reporter,
						baseEnv: sanitizedEnv,
					}),
				);
			});
		} else {
			fileTests.runWith.forEach((rBy) => {
				let testFiles: TestFile[];
				switch (rBy) {
					case RunWith.Node:
						testFiles = copiedTestFiles;
						break;
					default:
						throw new Error(
							`Unimplemented testFile mapping for ${rBy} and non-typescript configuration!`,
						);
				}
				fileTestRunners.push(
					new FileTestRunner({
						projectDir: testProjectDir,
						runCommand: `${binRunCmd} ${rBy}`,
						testFiles,
						runBy: rBy,
						pkgManagerAlias,
						pkgManager,
						modType,
						failFast,
						extraEnv: {},
						timeout,
						reporter,
						baseEnv: sanitizedEnv,
					}),
				);
			});
		}
	}

	let binTestRunner: BinTestRunner | undefined = undefined;
	// If this runs bintests, set those up as well
	if (testOptions.binTests) {
		binTestRunner = new BinTestRunner({
			runCommand: binRunCmd,
			projectDir: testProjectDir,
			binTestConfig: testOptions.binTests,
			pkgManager,
			pkgManagerAlias,
			modType,
			timeout,
			failFast,
			reporter,
			baseEnv: sanitizedEnv,
		});
	}

	let scriptTestRunner: ScriptTestRunner | undefined = undefined;
	if (scriptTests) {
		scriptTestRunner = new ScriptTestRunner({
			runCommand: getPkgScriptRunnerCommand(pkgManager, pkgManagerVersion),
			projectDir: testProjectDir,
			scriptTests,
			pkgManager,
			pkgManagerAlias,
			modType,
			timeout,
			failFast,
			reporter,
			baseEnv: sanitizedEnv,
		});
	}

	// Copy over files at the end
	if (additionalFiles) {
		await copyOverAdditionalFiles(additionalFiles, testProjectDir);
	}

	if (createAdditionalFiles) {
		await Promise.all(
			createAdditionalFiles.map(async (caf) => {
				const [contents, path] = await Promise.resolve(
					caf(context.config, {
						projectDir,
						testProjectDir,
						binTests: testOptions.binTests,
						fileTests,
						packageManager: pkgManager,
						packageManagerAlias: pkgManagerAlias,
						moduleType: modType,
					}),
				);
				await writeFile(resolve(testProjectDir, path), contents);
			}),
		);
	}

	return {
		binTestRunner,
		scriptTestRunner,
		fileTestRunners,
	};
}
