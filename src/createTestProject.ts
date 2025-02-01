import { cp, readFile, writeFile } from "fs/promises";
import { basename, join, relative } from "path";
import { getAllMatchingFiles } from "./getAllMatchingFiles";
import { execSync } from "child_process";
import { ModuleTypes, PkgManager, RunBy, TypescriptOptions } from "./types";
import { getTypescriptConfig } from "./getTypescriptConfig";
import { createDependencies } from "./createDependencies";
import { getPkgBinaryRunnerCommand } from "./getPkgBinaryRunnerCommand";
import { TestRunner } from "./TestRunner";

/**
 * Creates a test project (the physical package.json folder) for a given configuration
 * and then returns the different TestRunners that represent a unit of tests that are run the
 * same way.
 *
 * @param context
 * @param options
 * @returns
 */
export async function createTestProject(
	context: {
		projectDir: string;
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
		pkgManager: PkgManager;
		testMatch: string;
		typescript?: TypescriptOptions;
	},
) {
	const { projectDir, testProjectDir, debug } = context;

	const { runBy, modType, pkgManager, testMatch, typescript } = options;

	if (debug) {
		console.log(`Generating package.json at ${testProjectDir}...`);
	}
	const relativePath = relative(testProjectDir, projectDir);
	const packageJson = JSON.parse(
		(await readFile(join(projectDir, "package.json"))).toString(),
	);

	// Add the module type of the test package
	const typeProps: {
        type?: 'module'
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
		name: `@dummy-test-package/test-${modType}-`,
		description: `Compiled tests for ${packageJson.name} as ${modType} project import`,
		...typeProps,
		dependencies: createDependencies(packageJson, relativePath, options),
		private: true,
	};
	// Write the package.json to the directory
	await writeFile(
		join(testProjectDir, "package.json"),
		JSON.stringify(pkgJson, null, 4),
	);
	if (debug) {
		console.log(`Finished writing package.json at ${testProjectDir}`);
	}

	if (debug) {
		console.log(`Running package installation at ${testProjectDir}...`);
	}
	// depending on the type of package manager - perform installs
	switch (pkgManager) {
		case PkgManager.Npm:
			execSync("npm install", {
				cwd: testProjectDir,
			});
			break;
		case PkgManager.YarnV1:
			execSync("yarn install", {
				cwd: testProjectDir,
			});
			break;
		case PkgManager.YarnV4:
			execSync("corepack enable && yarn install", {
				cwd: testProjectDir,
			});
			break;
		case PkgManager.Pnpm:
			execSync("pnpm install", {
				cwd: testProjectDir,
			});
			break;
		default:
			throw new Error(
				`Unimplemented package manager install for: ${pkgManager}`,
			);
	}
	if (debug) {
		console.log(`Finished installation at ${testProjectDir}.`);
	}

	const testFiles = await getAllMatchingFiles(projectDir, testMatch);
	const srcDir = "src";
	const absSrcPath = join(projectDir, srcDir);

	if (debug) {
		console.log(`Copying ${testFiles.length} test files to ${absSrcPath}...`);
	}

	// Copy over the test files to the project directory
	const copiedTestFiles = await Promise.all(
		testFiles.map(async (tf) => {
			const copiedTestFile = join(absSrcPath, basename(tf));
			await cp(tf, copiedTestFile);
			return copiedTestFile;
		}),
	);

	if (debug) {
		console.log(`Finished copying test files to ${absSrcPath}.`);
	}

	const runners: TestRunner[] = [];
	const binRunCmd = getPkgBinaryRunnerCommand(pkgManager);
	// Add a tsconfig file if we are using typescript transpilation
	if (typescript) {
		const configFilePath = `tsconfig.${modType}.json`;
		if (debug) {
			console.log(`Creating ${configFilePath} at ${testProjectDir}...`);
		}
		const tsConfig = getTypescriptConfig(
			{
				modType,
				tsBuildDir: "dist",
				tsSrcDir: srcDir,
			},
			typescript,
		);
		await writeFile(
			join(testProjectDir, configFilePath),
			JSON.stringify(tsConfig, null, 4),
		);
		if (debug) {
			console.log(`Created ${configFilePath} at ${testProjectDir}.`);
		}

		if (debug) {
			console.log(`Compiling ${configFilePath} at ${testProjectDir}...`);
		}
		// Transpile the typescript projects
		execSync(`${binRunCmd} tsc -p ${configFilePath}`, {
			cwd: testProjectDir,
		});
		if (debug) {
			console.log(`Compiled ${configFilePath} at ${testProjectDir}.`);
		}

		const absBuildPath = join(projectDir, tsConfig.outDir);

		runBy.forEach((rBy) => {
			let testFiles: string[];
			switch (rBy) {
				case RunBy.Node:
					testFiles = copiedTestFiles;
					break;
				case RunBy.TsNode:
				case RunBy.Tsx:
					testFiles = copiedTestFiles.map((srcFile) =>
						srcFile.replace(absSrcPath, absBuildPath),
					);
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
				}),
			);
		});
		return runners;
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
				}),
			);
		});
	}
	return runners;
}
