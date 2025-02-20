import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import {
	DEFAULT_CONFIG_FILE_NAME_BASE,
	getConfig,
	LIBRARY_NAME,
} from "./config";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { ModuleTypes, PkgManager, RunWith, TestConfig } from "./types";
import { DEFAULT_PKG_MANAGER_ALIAS } from "./constants";

const explicitConfigFileName = "someCustomConfig";
const explicitConfig: TestConfig = {
	locks: false,
	entries: [
		{
			packageManagers: [PkgManager.YarnV1],
			moduleTypes: [ModuleTypes.Commonjs, ModuleTypes.ESM],
			fileTests: {
				testMatch: "something**.ts",
				runWith: [RunWith.Node],
				transforms: {
					typescript: {
						version: "^5.0.0",
						tsNode: {
							version: "^10.9.2",
						},
						tsx: {
							version: "^4.19.2",
						},
						nodeTypes: {
							version: "^20.0.0",
						},
					}, // Use the defaults, but we do want typescript transformation
				},
			},
		},
	],
};
const expExplicitStdConfig = {
	...explicitConfig,
	entries: explicitConfig.entries.map((e, idx) => {
		return {
			...e,
			alias: `entry${idx}`,
			packageManagers: e.packageManagers.map((pm) => {
				return typeof pm === "string"
					? {
							packageManager: pm,
							alias: DEFAULT_PKG_MANAGER_ALIAS,
							options: {},
						}
					: pm;
			}),
		};
	}),
};
const defaultDetectedConfig: TestConfig = {
	entries: [
		{
			packageManagers: [PkgManager.YarnV1],
			moduleTypes: [ModuleTypes.Commonjs, ModuleTypes.ESM],
			fileTests: {
				runWith: [RunWith.Node],
				transforms: {
					typescript: {},
				},
				testMatch: "default**.ts",
			},
		},
	],
	locks: false,
};
const expDefaultDetectedStdConfig = {
	...defaultDetectedConfig,
	entries: defaultDetectedConfig.entries.map((e, idx) => {
		return {
			...e,
			alias: `entry${idx}`,
			packageManagers: e.packageManagers.map((pm) => {
				return typeof pm === "string"
					? {
							packageManager: pm,
							alias: DEFAULT_PKG_MANAGER_ALIAS,
							options: {},
						}
					: pm;
			}),
		};
	}),
};
const explictConfigJs = `
module.exports = ${JSON.stringify(explicitConfig, null, 4)};
`;
const defaultDetectedConfigJs = `
module.exports = ${JSON.stringify(defaultDetectedConfig, null, 4)};
`;
const packageJson = {
	name: "mypkg",
};

let tempDir: string;
beforeAll(() => {
	tempDir = mkdtempSync(join(tmpdir(), "configTest-"));
	// Create files
	writeFileSync(
		join(tempDir, `${explicitConfigFileName}.json`),
		JSON.stringify(explicitConfig),
	);
	writeFileSync(
		join(tempDir, explicitConfigFileName),
		JSON.stringify(explicitConfig),
	);
});
afterAll(() => {
	// Clean up the directory afterwards
	rmSync(tempDir, {
		force: true,
		recursive: true,
	});
});

for (const ext of ["json", "js", "cjs", "mjs", "ts"]) {
	it(`gets absolute file paths (${ext})`, async () => {
		const testDir = join(tempDir, `abs-explicit-${ext}`);
		mkdirSync(testDir);
		const file = join(testDir, `${explicitConfigFileName}.${ext}`);
		writeFileSync(
			file,
			ext === "json" ? JSON.stringify(explicitConfig) : explictConfigJs,
		);
		// Use a different directory to make sure we use the absolute
		expect(await getConfig(file)).toEqual(expExplicitStdConfig);
	});

	it(`gets explicit file paths in the cwd (${ext})`, async () => {
		const testDir = join(tempDir, `relative-explicit-${ext}`);
		mkdirSync(testDir);
		const file = join(testDir, `${explicitConfigFileName}.${ext}`);
		writeFileSync(
			file,
			ext === "json" ? JSON.stringify(explicitConfig) : explictConfigJs,
		);
		writeFileSync(join(testDir, "package.json"), JSON.stringify(packageJson));
		// Use a different directory to make sure we use the absolute
		expect(
			await getConfig(`${explicitConfigFileName}.${ext}`, testDir),
		).toEqual(expExplicitStdConfig);
	});

	it(`gets config by default name in the cwd (${ext})`, async () => {
		const testDir = join(tempDir, `default-${ext}`);
		mkdirSync(testDir);
		const file = join(testDir, `${DEFAULT_CONFIG_FILE_NAME_BASE}.${ext}`);
		writeFileSync(
			file,
			ext === "json"
				? JSON.stringify(defaultDetectedConfig)
				: defaultDetectedConfigJs,
		);
		// Write a custom file too
		writeFileSync(
			join(tempDir, `${explicitConfigFileName}.json`),
			"something that should break parsing",
		);
		writeFileSync(join(testDir, "package.json"), JSON.stringify(packageJson));
		expect(await getConfig(file, testDir)).toEqual(expDefaultDetectedStdConfig);
	});
}

it("throws an error if we cannot find a package.json in the cwd", async () => {
	const testDir = join(tempDir, `require-pkgjson`);
	mkdirSync(testDir);
	const file = join(testDir, `${DEFAULT_CONFIG_FILE_NAME_BASE}.json`);
	writeFileSync(file, JSON.stringify(defaultDetectedConfig));
	// Write a custom file too
	writeFileSync(
		join(tempDir, `${explicitConfigFileName}.json`),
		"something that should break parsing",
	);
	await expect(async () => await getConfig(file, testDir)).rejects.toThrow(
		"Must have a package.json at the same location as pkgtest config:",
	);
});

it("throws an error if binTests but no bin entry", async () => {
	const testDir = join(tempDir, `no-bin`);
	mkdirSync(testDir);
	const file = join(testDir, `${DEFAULT_CONFIG_FILE_NAME_BASE}.json`);
	writeFileSync(
		file,
		JSON.stringify({
			...defaultDetectedConfig,
			entries: [
				{
					...defaultDetectedConfig.entries[0],
					binTests: {},
				},
			],
		}),
	);
	// Write a custom file too
	writeFileSync(
		join(tempDir, `${explicitConfigFileName}.json`),
		"something that should break parsing",
	);
	writeFileSync(join(testDir, "package.json"), JSON.stringify(packageJson));
	await expect(async () => await getConfig(file, testDir)).rejects.toThrow(
		'entries[0] binTests are configured but there is no "bin" property in the package.json!',
	);
});

it("throws an error if binTests has a missing command", async () => {
	const testDir = join(tempDir, `missing-bin-command`);
	mkdirSync(testDir);
	const file = join(testDir, `${DEFAULT_CONFIG_FILE_NAME_BASE}.json`);
	writeFileSync(
		file,
		JSON.stringify({
			...defaultDetectedConfig,
			entries: [
				{
					...defaultDetectedConfig.entries[0],
					binTests: {
						command1: [
							{
								args: "something",
							},
						],
					},
				},
			],
		}),
	);
	// Write a custom file too
	writeFileSync(
		join(tempDir, `${explicitConfigFileName}.json`),
		"something that should break parsing",
	);
	writeFileSync(
		join(testDir, "package.json"),
		JSON.stringify({
			...packageJson,
			bin: {
				cmd1: "something.js",
			},
		}),
	);
	await expect(async () => await getConfig(file, testDir)).rejects.toThrow(
		"entries[0] command1 in binTests configuration does not have a matching bin entry in the package.json",
	);
});

it("throws an error if binTests and fileTests are missing", async () => {
	const testDir = join(tempDir, `missing-alltests-command`);
	mkdirSync(testDir);
	const file = join(testDir, `${DEFAULT_CONFIG_FILE_NAME_BASE}.json`);
	writeFileSync(
		file,
		JSON.stringify({
			...defaultDetectedConfig,
			entries: [
				{
					...defaultDetectedConfig.entries[0],
					binTests: undefined,
					fileTests: undefined,
				},
			],
		}),
	);
	// Write a custom file too
	writeFileSync(
		join(tempDir, `${explicitConfigFileName}.json`),
		"something that should break parsing",
	);
	writeFileSync(
		join(testDir, "package.json"),
		JSON.stringify({
			...packageJson,
			bin: {
				cmd1: "something.js",
			},
		}),
	);
	await expect(async () => await getConfig(file, testDir)).rejects.toThrow(
		"entries[0] must supply at least one binTests or fileTests config!",
	);
});

it("adds default commands for missing bin fields", async () => {
	const testDir = join(tempDir, `default-bin-commands`);
	mkdirSync(testDir);
	const file = join(testDir, `${DEFAULT_CONFIG_FILE_NAME_BASE}.json`);
	writeFileSync(
		file,
		JSON.stringify({
			...defaultDetectedConfig,
			entries: [
				{
					...defaultDetectedConfig.entries[0],
					binTests: {
						cmd1: [
							{
								args: "something",
							},
						],
					},
				},
			],
		}),
	);
	// Write a custom file too
	writeFileSync(
		join(tempDir, `${explicitConfigFileName}.json`),
		"something that should break parsing",
	);
	writeFileSync(
		join(testDir, "package.json"),
		JSON.stringify({
			...packageJson,
			bin: {
				cmd2: "somethingelse.js",
				cmd1: "something.js",
			},
		}),
	);
	expect(await getConfig(file, testDir)).toEqual({
		...defaultDetectedConfig,
		entries: [
			{
				...defaultDetectedConfig.entries[0],
				alias: "entry0",
				packageManagers: defaultDetectedConfig.entries[0].packageManagers.map(
					(pm) => {
						return typeof pm === "string"
							? {
									packageManager: pm,
									alias: DEFAULT_PKG_MANAGER_ALIAS,
									options: {},
								}
							: pm;
					},
				),
				binTests: {
					cmd1: [
						{
							args: "something",
						},
					],
					cmd2: [
						{
							args: "--help",
						},
					],
				},
			},
		],
	});
});

it("handles binTests only", async () => {
	const testDir = join(tempDir, `bin-tests-only`);
	mkdirSync(testDir);
	const file = join(testDir, `${DEFAULT_CONFIG_FILE_NAME_BASE}.json`);
	writeFileSync(
		file,
		JSON.stringify({
			...defaultDetectedConfig,
			entries: [
				{
					...defaultDetectedConfig.entries[0],
					fileTests: undefined,
					binTests: {},
				},
			],
		}),
	);
	// Write a custom file too
	writeFileSync(
		join(tempDir, `${explicitConfigFileName}.json`),
		"something that should break parsing",
	);
	writeFileSync(
		join(testDir, "package.json"),
		JSON.stringify({
			...packageJson,
			bin: {
				cmd2: "somethingelse.js",
				cmd1: "something.js",
			},
		}),
	);
	const { fileTests, packageManagers, ...expEntry } =
		defaultDetectedConfig.entries[0];
	expect(await getConfig(file, testDir)).toEqual({
		...defaultDetectedConfig,
		entries: [
			{
				alias: "entry0",
				...expEntry,
				packageManagers: packageManagers.map((pm) => {
					return typeof pm === "string"
						? {
								packageManager: pm,
								alias: DEFAULT_PKG_MANAGER_ALIAS,
								options: {},
							}
						: pm;
				}),
				binTests: {
					cmd1: [
						{
							args: "--help",
						},
					],
					cmd2: [
						{
							args: "--help",
						},
					],
				},
			},
		],
	});
});

it("throws an error if we cannot find the explict file", async () => {
	await expect(async () => getConfig("not-here.json")).rejects.toThrow(
		`Could not find a ${LIBRARY_NAME} config file ${resolve(process.cwd(), "not-here.json")}`,
	);
});

it("throws an error if we cannot find any default file", async () => {
	await expect(async () => getConfig(undefined, tempDir)).rejects.toThrow(
		`Unable to find ${LIBRARY_NAME} config file in default locations:`,
	);
});

it("throws an error if we find multiple default file matches", async () => {
	const testDir = join(tempDir, `multi-match`);
	mkdirSync(testDir);
	writeFileSync(
		join(testDir, `${DEFAULT_CONFIG_FILE_NAME_BASE}.json`),
		'{"value1": 1}',
	);
	writeFileSync(
		join(testDir, `${DEFAULT_CONFIG_FILE_NAME_BASE}.ts`),
		"export const value2 = 2;",
	);
	await expect(async () => getConfig(undefined, testDir)).rejects.toThrow(
		`unable to determine ${LIBRARY_NAME} config file!  Found multiple matches:\n${[
			resolve(testDir, `${DEFAULT_CONFIG_FILE_NAME_BASE}.json`),
			resolve(testDir, `${DEFAULT_CONFIG_FILE_NAME_BASE}.ts`),
		].join("\n")}`,
	);
});

it(`throws an error if the extension is not expected`, async () => {
	const testDir = join(tempDir, `unknown-ext`);
	mkdirSync(testDir);
	const file = join(testDir, `${explicitConfigFileName}.sum`);
	writeFileSync(file, explictConfigJs);
	// Use a different directory to make sure we use the absolute
	await expect(async () => getConfig(file)).rejects.toThrow(
		`Unimplemented handling of file extension for config file ${file}`,
	);
});
