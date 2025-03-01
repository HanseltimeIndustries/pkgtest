import { PkgManager } from "../types";
import { applyLockLocalFileEscaping } from "./applyLockLocalFileEscaping";

let originalPlatform: string = process.platform;

afterAll(function () {
	Object.defineProperty(process, "platform", {
		value: originalPlatform,
	});
});

it.each([
	[
		PkgManager.YarnV1,
		"win32",
		"C:\\something\\here\\he.txt",
		"C:\\\\something\\\\here\\\\he.txt",
	],
	[
		PkgManager.YarnV1,
		"win32",
		"C:\\\\something\\\\here\\he.txt",
		"C:\\\\something\\\\here\\\\he.txt",
	],
	[PkgManager.YarnV1, "darwin", "/hey/there/fam", "/hey/there/fam"],
	[
		PkgManager.YarnBerry,
		"win32",
		"C:\\something\\here\\he.txt",
		"C:/something/here/he.txt",
	],
	[
		PkgManager.YarnBerry,
		"win32",
		"C:\\\\something\\\\here\\he.txt",
		"C:/something/here/he.txt",
	],
	[PkgManager.YarnBerry, "darwin", "/hey/there/fam", "/hey/there/fam"],
	[
		PkgManager.Pnpm,
		"win32",
		"C:\\\\something\\\\here\\he.txt",
		"C:\\\\something\\\\here\\he.txt",
	],
	[PkgManager.Pnpm, "win32", "/hey/there/fam", "/hey/there/fam"],
	[
		PkgManager.Npm,
		"win32",
		"C:\\\\something\\\\here\\he.txt",
		"C:/something/here/he.txt",
	],
	[PkgManager.Npm, "darwin", "/hey/there/fam", "/hey/there/fam"],
])("handles windows files for %s %s %s", (pkgManager, platform, path, exp) => {
	Object.defineProperty(process, "platform", {
		value: platform,
	});
	expect(applyLockLocalFileEscaping(pkgManager, path)).toEqual(exp);
});
