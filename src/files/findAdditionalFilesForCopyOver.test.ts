import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { findAdditionalFilesForCopyOver } from "./findAdditionalFilesForCopyOver";

let tempDir: string;
let rootDir: string;
beforeAll(() => {
	tempDir = mkdtempSync(join(tmpdir(), "findAdditionalFilesForCopyOver-"));
	// Create files
	writeFileSync(join(tempDir, "file1.txt"), "file1");
	writeFileSync(join(tempDir, "file2.txt"), "file2.txt");
	rootDir = join(tempDir, "root");
	mkdirSync(rootDir);
	writeFileSync(join(rootDir, "someFile.txt"), "someFile");
	writeFileSync(join(rootDir, "zoo.ts"), "zoo");
});
afterAll(() => {
	// Clean up the directory afterwards
	rmSync(tempDir, {
		force: true,
		recursive: true,
	});
});

it("finds absolute paths", async () => {
	const fullUrl1 = resolve(tempDir, "file1.txt");
	const fullUrl2 = resolve(tempDir, "file2.txt");
	expect(
		await findAdditionalFilesForCopyOver({
			additionalFiles: [fullUrl1, [fullUrl2, "someDir"]],
			projectDir: tempDir,
			rootDir,
		}),
	).toEqual([
		{
			files: [fullUrl1],
			toDir: ".",
		},
		{
			files: [fullUrl2],
			toDir: "someDir",
		},
	]);
});

it("finds relative paths with default rootDir", async () => {
	expect(
		await findAdditionalFilesForCopyOver({
			additionalFiles: ["someFile.txt", ["zoo.ts", "someDir"]],
			projectDir: tempDir,
			rootDir,
		}),
	).toEqual([
		{
			files: [resolve(rootDir, "someFile.txt")],
			toDir: ".",
		},
		{
			files: [resolve(rootDir, "zoo.ts")],
			toDir: "someDir",
		},
	]);
});

it("finds relative paths with configDir substitution", async () => {
	expect(
		await findAdditionalFilesForCopyOver({
			additionalFiles: [
				"${configDir}/file1.txt",
				["${configDir}/file2.txt", "someDir"],
			],
			projectDir: tempDir,
			rootDir,
		}),
	).toEqual([
		{
			files: [resolve(tempDir, "file1.txt")],
			toDir: ".",
		},
		{
			files: [resolve(tempDir, "file2.txt")],
			toDir: "someDir",
		},
	]);
});

it("finds relative paths with rootDir substitution", async () => {
	expect(
		await findAdditionalFilesForCopyOver({
			additionalFiles: [
				"${rootDir}/someFile.txt",
				["${rootDir}/zoo.ts", "someDir"],
			],
			projectDir: tempDir,
			rootDir,
		}),
	).toEqual([
		{
			files: [resolve(rootDir, "someFile.txt")],
			toDir: ".",
		},
		{
			files: [resolve(rootDir, "zoo.ts")],
			toDir: "someDir",
		},
	]);
});

it("throws an error if the path is not found", async () => {
	await expect(
		async () =>
			await findAdditionalFilesForCopyOver({
				additionalFiles: [
					"${rootDir}/someFile.txt",
					["${rootDir}/zoo2.ts", "someDir"],
				],
				projectDir: tempDir,
				rootDir,
			}),
	).rejects.toThrow(
		`Additional file path does not exist: ${resolve(rootDir, "zoo2.ts")}`,
	);
});
