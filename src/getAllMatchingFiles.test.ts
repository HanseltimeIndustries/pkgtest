import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getAllMatchingFiles } from "./getAllMatchingFiles";

let tempDir: string;
beforeAll(() => {
	tempDir = mkdtempSync(join(tmpdir(), "getAllMatchingFilesTest-"));
	// Create files
	writeFileSync(join(tempDir, "test1.pkgtest.ts"), "test1");
	writeFileSync(join(tempDir, "another1.pkgtest.ts"), "anoter1");
	writeFileSync(join(tempDir, "pkgtest.foo.ts"), "pkgtest");
	const nested1 = join(tempDir, "nested");
	mkdirSync(nested1);
	writeFileSync(join(nested1, "someFile.txt"), "someFile");
	writeFileSync(join(nested1, "zoo.pkgtest.ts"), "zoo");
	const nested2 = join(nested1, "nested2");
	mkdirSync(nested2);
	writeFileSync(join(nested2, "inner.txt"), "inner");
	writeFileSync(join(nested2, "bottom.pkgtest.ts"), "bottom");
	// Create a no match dir too
	const noMatch = join(tempDir, "noMatch");
	mkdirSync(noMatch);
	writeFileSync(join(noMatch, "nope.txt"), "nope");
});
afterAll(() => {
	// Clean up the directory afterwards
	rmSync(tempDir, {
		force: true,
		recursive: true,
	});
});

it("matches and returns absolute paths", async () => {
	const matches = await getAllMatchingFiles(tempDir, "**/*.pkgtest.ts");
	const expectedMatches = [
		join(tempDir, "test1.pkgtest.ts"),
		join(tempDir, "another1.pkgtest.ts"),
		join(tempDir, "nested", "zoo.pkgtest.ts"),
		join(tempDir, "nested", "nested2", "bottom.pkgtest.ts"),
	];
	expect(matches).toHaveLength(expectedMatches.length);
	expect(matches).toEqual(expect.arrayContaining(expectedMatches));
});
