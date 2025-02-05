import { existsSync, readFileSync } from "fs";
import { isAbsolute, extname, resolve } from "path";
import { ModuleTypes, PkgManager, RunBy, TypescriptOptions } from "./types";

export const LIBRARY_NAME = "pkgTest";
export const DEFAULT_CONFIG_FILE_NAME_BASE = `pkgtest.config`;

interface TestConfigEntry {
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
	packageManagers: PkgManager[];
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

// Note, we use an object so that future augmentation can be easier and not require migrations
interface TestConfig {
	entries: TestConfigEntry[];
}

const allowdScriptExtensions = ["js", "cjs", "mjs", "ts"];

/**
 * Retrieves the test Configuration object from either the default paths in the cwd or from the absolute path
 * provided by the configFile
 * @param configFile
 * @returns
 */
export async function getConfig(configFile?: string, cwd = process.cwd()) {
	let resolvedFile: string | undefined;
	if (configFile) {
		if (isAbsolute(configFile)) {
			resolvedFile = configFile;
		} else {
			resolvedFile = resolve(cwd, configFile);
		}
	} else {
		// Default config file look up behavior
		const potentialFilePaths = ["json", ...allowdScriptExtensions].map((ext) =>
			resolve(cwd, `${DEFAULT_CONFIG_FILE_NAME_BASE}.${ext}`),
		);
		// Look for the various importable files
		const multiMatch: string[] = [];
		for (const filePath of potentialFilePaths) {
			if (existsSync(filePath)) {
				if (resolvedFile) {
					multiMatch.push(filePath);
				} else {
					resolvedFile = filePath;
				}
			}
		}
		if (multiMatch.length > 0) {
			throw new Error(
				`unable to determine ${LIBRARY_NAME} config file!  Found multiple matches:\n${[
					resolvedFile,
					...multiMatch,
				].join("\n")}`,
			);
		}
		if (!resolvedFile) {
			throw new Error(
				`Unable to find ${LIBRARY_NAME} config file in default locations:\n${potentialFilePaths.join(
					"\n",
				)}`,
			);
		}
	}

	if (!existsSync(resolvedFile)) {
		throw new Error(
			`Could not find a ${LIBRARY_NAME} config file ${resolvedFile}`,
		);
	}

	const ext = extname(resolvedFile);
	if (ext === ".json") {
		return JSON.parse(readFileSync(resolvedFile).toString()) as TestConfig;
	}

	if (allowdScriptExtensions.some((allowed) => ext.endsWith(`.${allowed}`))) {
		return (await import(resolvedFile)).default as TestConfig;
	}

	throw new Error(
		`Unimplented handling of file extension for config file ${resolvedFile}`,
	);
}
