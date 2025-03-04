import { existsSync, readFileSync } from "fs";
import { isAbsolute, extname, resolve, join } from "path";
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
	BinTestConfig,
	AdditionalFilesEntry,
	AddFileCopyTo,
	AddFilePerTestProjectCreate,
	ScriptTestConfig,
} from "./types";
import { z, ZodError, ZodType } from "zod";
import { fromError } from "zod-validation-error";
import { readFile } from "fs/promises";
import { DEFAULT_PKG_MANAGER_ALIAS } from "./constants";

export const LIBRARY_NAME = "pkgtest";
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
	version: z.string().optional(),
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
			options: YarnV4OptionsValidated.optional(),
		}),
		z.object({
			packageManager: z.literal(PkgManager.YarnV1),
			alias: z.string(),
			version: z.string().optional(),
			options: PkgManagerBaseOptionsValidated.optional(),
		}),
		z.object({
			packageManager: z.literal(PkgManager.Npm),
			alias: z.string(),
			version: z.string().optional(),
			options: PkgManagerBaseOptionsValidated.optional(),
		}),
		z.object({
			packageManager: z.literal(PkgManager.Pnpm),
			alias: z.string(),
			version: z.string().optional(),
			options: PkgManagerBaseOptionsValidated.optional(),
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

const AdditionalFileCopyToValidated = z.tuple([
	z.string(),
	z.string(),
]) satisfies ZodType<AddFileCopyTo>;

const AdditionalFilesEntryValidated = z.union([
	z.string(),
	AdditionalFileCopyToValidated,
]) satisfies ZodType<AdditionalFilesEntry>;

const BinTestsValidated = z.record(
	z.string(),
	z.array(
		z.object({
			args: z.string(),
			env: z.record(z.string(), z.string()).optional(),
		}),
	),
) satisfies ZodType<BinTestConfig>;

const FileTestsValidated = z.object({
	testMatch: z
		.string()
		.describe(
			"A glob patterned string from the cwd (the package root) that will identify any pkgTest files to copy into respective package tests and then run.",
		),
	runWith: z
		.array(z.nativeEnum(RunWith))
		.describe(`The various ways that you want to run the scripts in question to verify they work as expected.
Note, we will run each way per package manager + module project that is created.`),
	transforms: TransformValidated,
});

// TODO: we could make this more descriptive but the lambda is more of an escape hatch than standard
const AddFilePerTestProjectCreateValidated = z
	.function()
	.args(z.any(), z.any())
	.returns(z.any()) satisfies ZodType<AddFilePerTestProjectCreate>;

const ScriptTestConfigValidated = z.object({
	name: z.string(),
	script: z.string(),
}) satisfies ZodType<ScriptTestConfig>;

const TestConfigEntryValidated = z.object({
	fileTests: FileTestsValidated.optional(),
	scriptTests: z.array(ScriptTestConfigValidated).optional(),
	packageManagers: z
		.array(
			z.union([
				z.nativeEnum(PkgManager),
				AdvancedPackageManagerOptionsValidated,
			]),
		)
		.describe(`Which package managed we will use to install dependencies and run the various test scripts provided.
Important - to preserve integrity during testing, each module type will get a brand new project per package manager to avoid dependency install and access issues.`),
	moduleTypes: z
		.array(z.nativeEnum(ModuleTypes))
		.describe(`A list of module types that we will import the package under test with.  If you are using typescript, you will probably want the same configuration for both moduleTypes and will only need one TetsConfigEntry for both.
If you are writing in raw JS though, you will more than likely need to keep ESM and CommonJS equivalent versions of each package test and therefore will need to have an entry with ["commonjs"] and ["esm"] separately so that you can change the testMatch to pick the correct files.`),
	additionalDependencies,
	additionalFiles: z
		.array(
			z.union([
				AdditionalFilesEntryValidated,
				AddFilePerTestProjectCreateValidated,
			]),
		)
		.optional(),
	binTests: BinTestsValidated.optional(),
	timeout: z.number().optional(),
	packageJson: z.record(z.string(), z.any()).optional(),
}) satisfies ZodType<TestConfigEntry>;

const TestConfigValidated = z.object({
	rootDir: z.string().optional(),
	matchIgnore: z.array(z.string()).optional(),
	additionalDependencies,
	additionalFiles: z.array(AdditionalFilesEntryValidated).optional(),
	entries: z
		.array(TestConfigEntryValidated)
		.describe(
			"Test Package configurations to setup and run.  Having more than 1 is mainly if you need different files to test different runners or module types.",
		),
	packageJson: z.record(z.string(), z.any()).optional(),
	locks: z.union([
		z.boolean(),
		z.object({
			folder: z.string(),
		}),
	]),
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
	let rawConfig: TestConfig;
	try {
		// windows loading requires file://
		if (process.platform === "win32") {
			resolvedFile = `file://${resolvedFile}`;
		}
		if (ext === ".json") {
			rawConfig = TestConfigValidated.parse(
				JSON.parse(readFileSync(resolvedFile).toString()),
			);
		} else if (
			allowdScriptExtensions.some((allowed) => ext.endsWith(`.${allowed}`))
		) {
			rawConfig = TestConfigValidated.parse(
				(await import(resolvedFile)).default,
			);
		} else {
			throw new Error(
				`Unimplemented handling of file extension for config file ${resolvedFile}`,
			);
		}
	} catch (err) {
		if (err instanceof ZodError) {
			// Just clean up the error a little
			throw new Error(`Configuration Parsing Error!\n${fromError(err)}`);
		}
		throw err;
	}

	// Validate portions of config that are harder to define
	const packageJsonPath = join(cwd, "package.json");
	if (!existsSync(packageJsonPath)) {
		throw new Error(
			`Must have a package.json at the same location as pkgtest config: ${packageJsonPath}`,
		);
	}
	const packageJson = JSON.parse((await readFile(packageJsonPath)).toString());
	const { bin } = packageJson;
	const binCmds = !bin
		? []
		: typeof bin === "string"
			? [
					packageJson.name.slice(
						packageJson.name.indexOf("/") >= 0
							? packageJson.name.indexOf("/") + 1
							: 0,
					),
				]
			: Object.keys(packageJson.bin);

	const { entries: rawEntries, ...restOfConfig } = rawConfig;

	const stdEntries: StandardizedTestConfigEntry[] = rawEntries.map(
		(ent, idx) => {
			const entryLocation = `entries[${idx}]`;
			const entryAlias = `entry${idx}`;

			if (!ent.fileTests && !ent.binTests && !ent.scriptTests) {
				throw new Error(
					`${entryLocation} must supply at least one binTests, scriptTests, or fileTests config!`,
				);
			}
			// Coerce bin tests to a default config
			let stdBinTests: StandardizedTestConfigEntry["binTests"] | undefined;
			if (ent.binTests) {
				// By default create a bin help configuration
				if (!packageJson.bin) {
					throw new Error(
						`${entryLocation} binTests are configured but there is no "bin" property in the package.json!`,
					);
				}

				// Validate the entry
				Object.keys(ent.binTests).forEach((binCmd) => {
					if (!binCmds.includes(binCmd)) {
						throw new Error(
							`${entryLocation} ${binCmd} in binTests configuration does not have a matching bin entry in the package.json`,
						);
					}
				});

				stdBinTests = binCmds.reduce(
					(fconfig, binCmd) => {
						if (!fconfig[binCmd]) {
							fconfig[binCmd] = [
								{
									args: "--help",
								},
							];
						}
						return fconfig;
					},
					{ ...ent.binTests },
				);
			}

			// Verify that we don't have overlapping pkg aliases in the same entry
			// And coerce to default standard object
			const usedPkgManagerAliasMap = Object.values(PkgManager).reduce(
				(used, pkgm) => {
					used.set(pkgm, new Set<string>());
					return used;
				},
				new Map<string, Set<string>>(),
			);

			const stdPackageManagers: StandardizedTestConfigEntry["packageManagers"] =
				ent.packageManagers.map((_pkgManager, idx) => {
					let pkgManagerObject: PkgManagerOptionsConfig<PkgManager>;
					if (typeof _pkgManager === "string") {
						// Override with a full object for standard look up
						pkgManagerObject = {
							packageManager: _pkgManager,
							alias: DEFAULT_PKG_MANAGER_ALIAS,
							options: {},
						};
						ent.packageManagers[idx] = pkgManagerObject;
					} else {
						pkgManagerObject = _pkgManager;
					}
					// Ensure the alias is unique to the entry
					const usedAliases = usedPkgManagerAliasMap.get(
						pkgManagerObject.packageManager,
					);
					if (usedAliases?.has(pkgManagerObject.alias!)) {
						throw new Error(
							`Cannot provide the same pkgManager alias for ${pkgManagerObject.packageManager} configuration! ${pkgManagerObject.alias}`,
						);
					}
					usedAliases?.add(pkgManagerObject.alias);

					return pkgManagerObject;
				});

			return {
				...ent,
				alias: entryAlias,
				packageManagers: stdPackageManagers,
				binTests: stdBinTests,
			};
		},
	);

	return {
		...restOfConfig,
		entries: stdEntries,
	} as StandardizedTestConfig;
}

// A more rigid config entry that we use programmatically
export interface StandardizedTestConfigEntry
	extends Omit<TestConfigEntry, "packageManagers"> {
	// An alias for the entry, used when saving lock files and otherwise denoting which entry something happened in
	alias: string;
	// We provide a default resolved config here
	packageManagers: PkgManagerOptionsConfig<PkgManager>[];
}

export interface StandardizedTestConfig extends Omit<TestConfig, "entries"> {
	entries: StandardizedTestConfigEntry[];
}
