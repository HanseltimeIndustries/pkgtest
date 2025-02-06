import { cp, readFile, writeFile, rm } from "fs/promises";
import { isAbsolute, join, relative } from "path";
import { getAllMatchingFiles } from "./getAllMatchingFiles";
import { exec, ExecOptions } from "child_process";
import {
	ModuleTypes,
	PkgManager,
	RunBy,
	TypescriptOptions,
	PkgManagerOptions,
	YarnV4Options,
} from "./types";
import { getTypescriptConfig } from "./getTypescriptConfig";
import {
	createDependencies,
	CreateDependenciesOptions,
} from "./createDependencies";
import {
	getPkgBinaryRunnerCommand,
	getPkgManagerCommand,
	getPkgManagerSetCommand,
} from "./pkgManager";
import { TestRunner } from "./TestRunner";
import * as yaml from "js-yaml";
import { Logger } from "./Logger";

export const SRC_DIRECTORY = "src";
export const BUILD_DIRECTORY = "dist";

/**
 * Creates a test project (the physical package.json folder) for a given configuration
 * and then returns the different TestRunners that represent a unit of tests that are run the
 * same way.
 *
 * @param context
 * @param options
 * @returns
 */
export async function createTestProject<PkgManagerT extends PkgManager>(
	context: {
		/**
		 * Absolute path to the project under test directory
		 */
		projectDir: string;
		/**
		 * Absolute path to the directory we created for temporary testing
		 */
		testProjectDir: string;
		debug?: boolean;
		failFast?: boolean;
	},
	options: {
		/**
		 * The list of tools that we will use to run the pkgTests scripts
		 *
		 * Note: Ts based tooling will require the typescript property
		 *
		 * The node runner with typescript will run on the compiled typescript
		 */
		runBy: RunBy[];
		modType: ModuleTypes;
		pkgManager: PkgManagerT;
		/**
		 * If an advanced configuration was used, this is the package manager options for the specific manager
		 * (set up before installing)
		 */
		pkgManagerOptions?: PkgManagerOptions<PkgManagerT>;
		testMatch: string;
		additionalDependencies?: CreateDependenciesOptions["additionalDependencies"];
		typescript?: TypescriptOptions;
	},
): Promise<TestRunner[]> {
	const { projectDir, testProjectDir, debug, failFast } = context;

	if (!isAbsolute(projectDir)) {
		throw new Error("projectDir must be absolute path!");
	}
	if (!isAbsolute(testProjectDir)) {
		throw new Error("testProjectDir must be absolute path!");
	}

	const {
		runBy,
		modType,
		pkgManager,
		testMatch,
		typescript,
		pkgManagerOptions,
	} = options;
	const logPrefix = `[${pkgManager}, ${modType}, @${testProjectDir}]`;

	const testFiles = await getAllMatchingFiles(projectDir, testMatch);
	if (testFiles.length == 0) {
		throw new Error(`Cannot find any tests to match: ${testMatch}`);
	}
	const logger = new Logger({
		context: logPrefix,
		debug: !!debug,
	});

	logger.logDebug(`Generating package.json at ${testProjectDir}`);

	const relativePath = relative(testProjectDir, projectDir);
	const packageJson = JSON.parse(
		(await readFile(join(projectDir, "package.json"))).toString(),
	);

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

	const pkgJson = {
		name: `@dummy-test-package/test-${modType}`,
		description: `Compiled tests for ${packageJson.name} as ${modType} project import`,
		...typeProps,
		dependencies: createDependencies(packageJson, relativePath, {
			pkgManager: options.pkgManager,
			runBy: options.runBy,
			typescript: options.typescript,
			additionalDependencies: options.additionalDependencies,
		}),
		private: true,
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
	const pkgManagerCommand = getPkgManagerCommand(
		pkgManager,
		pkgManagerOptions?.version,
	);
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
	await controlledExec(
		getPkgManagerSetCommand(pkgManager, pkgManagerOptions?.version),
		{
			cwd: testProjectDir,
			env: process.env,
		},
		logger,
	);
	await controlledExec(
		`${pkgManagerCommand} install ${installCLiArgs}`,
		{
			cwd: testProjectDir,
			env: process.env,
		},
		logger,
	);
	logger.logDebug(`Finished installation (${pkgManager}) at ${testProjectDir}`);

	const absSrcPath = join(testProjectDir, SRC_DIRECTORY);

	logger.logDebug(`Copying ${testFiles.length} test files to ${absSrcPath}`);

	// Copy over the test files to the project directory
	const copiedTestFiles = await Promise.all(
		testFiles.map(async (tf) => {
			const copiedTestFile = tf.replace(projectDir, absSrcPath);
			await cp(tf, copiedTestFile);
			return copiedTestFile;
		}),
	);

	logger.logDebug(`Finished copying test files to ${absSrcPath}`);

	const runners: TestRunner[] = [];
	const binRunCmd = getPkgBinaryRunnerCommand(pkgManager);
	// Add a tsconfig file if we are using typescript transpilation
	if (typescript) {
		const configFilePath = `tsconfig.${modType}.json`;
		logger.logDebug(`Creating ${configFilePath} at ${testProjectDir}`);
		const tsConfig = getTypescriptConfig(
			{
				modType,
				tsBuildDir: BUILD_DIRECTORY,
				tsSrcDir: SRC_DIRECTORY,
			},
			typescript,
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
				env: process.env,
			},
			logger,
		);
		logger.logDebug(`Compiled ${configFilePath} at ${testProjectDir}`);

		const absBuildPath = join(testProjectDir, tsConfig.compilerOptions.outDir);

		runBy.forEach((rBy) => {
			let testFiles: string[];
			switch (rBy) {
				case RunBy.Node:
					testFiles = copiedTestFiles.map((srcFile) =>
						// Since ts builds to .js we also need to replace the extensions
						srcFile
							.replace(absSrcPath, absBuildPath)
							.replace(/\.tsx?$/, ".js"),
					);
					break;
				case RunBy.TsNode:
				case RunBy.Tsx:
					testFiles = copiedTestFiles;
					break;
				default:
					throw new Error(
						`Unimplemented testFile mapping for ${rBy} and typescript configuration!`,
					);
			}
			runners.push(
				new TestRunner({
					projectDir: testProjectDir,
					binRunCommand: binRunCmd,
					testFiles,
					runBy: rBy,
					pkgManager,
					modType,
					failFast,
				}),
			);
		});
	} else {
		runBy.forEach((rBy) => {
			let testFiles: string[];
			switch (rBy) {
				case RunBy.Node:
					testFiles = copiedTestFiles;
					break;
				default:
					throw new Error(
						`Unimplemented testFile mapping for ${rBy} and non-typescript configuration!`,
					);
			}
			runners.push(
				new TestRunner({
					projectDir: testProjectDir,
					binRunCommand: binRunCmd,
					testFiles,
					runBy: rBy,
					pkgManager,
					modType,
					failFast,
				}),
			);
		});
	}
	return runners;
}

async function controlledExec(
	cmd: string,
	options: ExecOptions,
	logger: Logger,
) {
	await new Promise<void>((res, rej) => {
		exec(cmd, options, (error, stdout, stderr) => {
			if (error) {
				logger.log(stdout);
				logger.error(stderr);
				rej(error);
			} else {
				if (stdout) {
					logger.logDebug(stdout);
				}
				if (stderr) {
					logger.logDebug(stderr);
				}
				res();
			}
		});
	});
}
