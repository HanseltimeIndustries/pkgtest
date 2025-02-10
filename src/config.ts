import { existsSync, readFileSync } from "fs";
import { isAbsolute, extname, resolve } from "path";
import {
	InstalledTool,
	ModuleTypes,
	PkgManagerOptionsConfig,
	PkgManager,
	PkgManagerBaseOptions,
	RunWith,
	TestConfig,
	TestConfigEntry,
	TypescriptOptions,
	YarnV4Options,
} from "./types";
import { z, ZodError, ZodType } from "zod";
import { fromError } from "zod-validation-error";

export const LIBRARY_NAME = "pkgTest";
export const DEFAULT_CONFIG_FILE_NAME_BASE = `pkgtest.config`;

const InstalledToolValidated = z.object({
	version: z
		.string()
		.optional()
		.describe(
			"Explicit version to test.  If not supplied, we will use the dependency/devDependency of the testing project or throw an error if we can't find anything",
		),
}) satisfies ZodType<InstalledTool>;

const TypescriptOptionsValidated = z.object({
	config: z
		.any()
		.describe(
			"Typescript configuration that is merged with the base typescript that is created",
		)
		.optional(),
	nodeTypes: InstalledToolValidated.describe(
		"The version of the @types/node",
	).optional(),
	tsx: InstalledToolValidated.describe(
		"Required if Tsx is included in the runBy section",
	).optional(),
	tsNode: InstalledToolValidated.describe(
		"Required if Tsx is included in the runBy section",
	).optional(),
}) satisfies ZodType<TypescriptOptions>;

const TransformValidated = z.object({
	typescript: TypescriptOptionsValidated,
});

const PkgManagerBaseOptionsValidated = z.object({
	installCliArgs: z.string().optional(),
}) satisfies ZodType<PkgManagerBaseOptions>;

const YarnV4OptionsValidated = z
	.object({
		yarnrc: z.any().describe("any .yarnrc.yml options").optional(),
	})
	.merge(PkgManagerBaseOptionsValidated) satisfies ZodType<YarnV4Options>;

const AdvancedPackageManagerOptionsValidated = z.discriminatedUnion(
	"packageManager",
	[
		z.object({
			packageManager: z.literal(PkgManager.YarnBerry),
			alias: z.string(),
			version: z.string().optional(),
			options: YarnV4OptionsValidated,
		}),
		z.object({
			packageManager: z.literal(PkgManager.YarnV1),
			alias: z.string(),
			version: z.string().optional(),
			options: PkgManagerBaseOptionsValidated,
		}),
		z.object({
			packageManager: z.literal(PkgManager.Npm),
			alias: z.string(),
			version: z.string().optional(),
			options: PkgManagerBaseOptionsValidated,
		}),
		z.object({
			packageManager: z.literal(PkgManager.Pnpm),
			alias: z.string(),
			version: z.string().optional(),
			options: PkgManagerBaseOptionsValidated,
		}),
	],
) satisfies ZodType<PkgManagerOptionsConfig<PkgManager>>;

const additionalDependencies = z
	.record(
		z.string().describe("The package name"),
		z.string().describe("The package version"),
	)
	.optional()
	.describe(
		"Additional dependencies that can't be inferred from the project's package.json or other explicit fields like \"typescript.tsx.version\".",
	);

const TestConfigEntryValidated = z.object({
	testMatch: z
		.string()
		.describe(
			"A glob patterned string from the cwd (the package root) that will identify any pkgTest files to copy into respective package tests and then run.",
		),
	packageManagers: z
		.array(
			z.union([
				z.nativeEnum(PkgManager),
				AdvancedPackageManagerOptionsValidated,
			]),
		)
		.describe(`Which package managed we will use to install dependencies and run the various test scripts provided.
Important - to preserve integrity during testing, each module type will get a brand new project per package manager to avoid dependency install and access issues.`),
	runWith: z
		.array(z.nativeEnum(RunWith))
		.describe(`The various ways that you want to run the scripts in question to verify they work as expected.
Note, we will run each way per package manager + module project that is created.`),
	moduleTypes: z
		.array(z.nativeEnum(ModuleTypes))
		.describe(`A list of module types that we will import the package under test with.  If you are using typescript, you will probably want the same configuration for both moduleTypes and will only need one TetsConfigEntry for both.
If you are writing in raw JS though, you will more than likely need to keep ESM and CommonJS equivalent versions of each package test and therefore will need to have an entry with ["commonjs"] and ["esm"] separately so that you can change the testMatch to pick the correct files.`),
	additionalDependencies,
	transforms: TransformValidated,
}) satisfies ZodType<TestConfigEntry>;

const TestConfigValidated = z.object({
	matchRootDir: z.string().optional(),
	matchIgnore: z.array(z.string()).optional(),
	additionalDependencies,
	entries: z
		.array(TestConfigEntryValidated)
		.describe(
			"Test Package configurations to setup and run.  Having more than 1 is mainly if you need different files to test different runners or module types.",
		),
}) satisfies ZodType<TestConfig>;

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
	try {
		if (ext === ".json") {
			return TestConfigValidated.parse(
				JSON.parse(readFileSync(resolvedFile).toString()),
			);
		}

		if (allowdScriptExtensions.some((allowed) => ext.endsWith(`.${allowed}`))) {
			return TestConfigValidated.parse((await import(resolvedFile)).default);
		}
	} catch (err) {
		if (err instanceof ZodError) {
			// Just clean up the error a little
			throw new Error(`Configuration Parsing Error!\n${fromError(err)}`);
		}
		throw err;
	}

	throw new Error(
		`Unimplemented handling of file extension for config file ${resolvedFile}`,
	);
}
