import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import {
	DEFAULT_CONFIG_FILE_NAME_BASE,
	getConfig,
	LIBRARY_NAME,
} from "./config";
import { tmpdir } from "os";
import { join, resolve } from "path";

const explicitConfigFileName = "someCustomConfig";
const explicitConfig = {
	someFields: "value",
};
const defaultDetectedConfig = {
	otherFields: "value2",
};
const explictConfigJs = `
module.exports = ${JSON.stringify(explicitConfig, null, 4)};
`;
const defaultDetectedConfigJs = `
module.exports = ${JSON.stringify(defaultDetectedConfig, null, 4)};
`;

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
		expect(await getConfig(file)).toEqual(explicitConfig);
	});

	it(`gets explicit file paths in the cwd (${ext})`, async () => {
		const testDir = join(tempDir, `relative-explicit-${ext}`);
		mkdirSync(testDir);
		const file = join(testDir, `${explicitConfigFileName}.${ext}`);
		writeFileSync(
			file,
			ext === "json" ? JSON.stringify(explicitConfig) : explictConfigJs,
		);
		// Use a different directory to make sure we use the absolute
		expect(
			await getConfig(`${explicitConfigFileName}.${ext}`, testDir),
		).toEqual(explicitConfig);
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
		expect(await getConfig(file, testDir)).toEqual(defaultDetectedConfig);
	});
}

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
		`Unimplented handling of file extension for config file ${file}`,
	);
});
