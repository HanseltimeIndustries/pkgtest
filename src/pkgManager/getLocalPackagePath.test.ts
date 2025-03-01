import { PkgManager } from "../types";
import { applyLockLocalFileEscaping } from "./applyLockLocalFileEscaping";
import { getLocalPackagePath } from "./getLocalPackagePath";

jest.mock("./applyLockLocalFileEscaping");

const mockApplyLockLocalFileEscaping = jest.mocked(applyLockLocalFileEscaping);

mockApplyLockLocalFileEscaping.mockImplementation((_pkgManager, path) => path);

let originalPlatform: string = process.platform;
afterAll(function () {
	Object.defineProperty(process, "platform", {
		value: originalPlatform,
	});
});

it.each([
	[
		PkgManager.Npm,
		"darwin",
		"../my/path/to/package",
		"file:../my/path/to/package",
	],
	[
		PkgManager.Npm,
		"win32",
		"..\\my\\path\\to\\package",
		"..\\my\\path\\to\\package",
	],
	[
		PkgManager.Pnpm,
		"darwin",
		"../my/path/to/package",
		"file:../my/path/to/package",
	],
	[
		PkgManager.Pnpm,
		"win32",
		"..\\my\\path\\to\\package",
		"..\\my\\path\\to\\package",
	],
	[
		PkgManager.YarnV1,
		"darwin",
		"../my/path/to/package",
		"file:../my/path/to/package",
	],
	[
		PkgManager.YarnV1,
		"win32",
		"..\\my\\path\\to\\package",
		"..\\my\\path\\to\\package",
	],
	[
		PkgManager.YarnBerry,
		"darwin",
		"../my/path/to/package",
		"portal:../my/path/to/package",
	],
	[
		PkgManager.YarnBerry,
		"win32",
		"../my/path/to/package",
		"portal:../my/path/to/package",
	],
])(
	"creates a local package path for %s on platform %s",
	(pkgManager, platform, p, exp) => {
		Object.defineProperty(process, "platform", {
			value: platform,
		});
		expect(getLocalPackagePath(pkgManager, p)).toEqual(exp);
	},
);
