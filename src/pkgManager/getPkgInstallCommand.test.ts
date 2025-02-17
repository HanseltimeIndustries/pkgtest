import { PkgManager } from "../types";
import { getPkgInstallCommand, LockFileMode } from "./getPkgInstallCommand";
import { getPkgManagerCommand } from "./getPkgManagerCommand";

jest.mock("./getPkgManagerCommand");

const mockGetPkgManagerCommand = jest.mocked(getPkgManagerCommand);

const testCmd = "someCmd";
const testExtraArgs = "extraArgs";

beforeEach(() => {
	jest.resetAllMocks();
	mockGetPkgManagerCommand.mockReturnValue(testCmd);
});

it.each([
	[PkgManager.Npm, LockFileMode.None, `${testCmd} install ${testExtraArgs}`],
	[PkgManager.Npm, LockFileMode.Update, `${testCmd} install ${testExtraArgs}`],
	[PkgManager.Npm, LockFileMode.Frozen, `${testCmd} ci ${testExtraArgs}`],
	[PkgManager.Pnpm, LockFileMode.None, `${testCmd} install ${testExtraArgs}`],
	[PkgManager.Pnpm, LockFileMode.Update, `${testCmd} install ${testExtraArgs}`],
	[
		PkgManager.Pnpm,
		LockFileMode.Frozen,
		`${testCmd} install --frozen-lockfile ${testExtraArgs}`,
	],
	[
		PkgManager.YarnBerry,
		LockFileMode.None,
		`${testCmd} install --no-immutable ${testExtraArgs}`,
	],
	[
		PkgManager.YarnBerry,
		LockFileMode.Update,
		`${testCmd} install --no-immutable ${testExtraArgs}`,
	],
	[
		PkgManager.YarnBerry,
		LockFileMode.Frozen,
		`${testCmd} install --immutable ${testExtraArgs}`,
	],
	[
		PkgManager.YarnV1,
		LockFileMode.None,
		`${testCmd} install --no-lockfile ${testExtraArgs}`,
	],
	[
		PkgManager.YarnV1,
		LockFileMode.Update,
		`${testCmd} install ${testExtraArgs}`,
	],
	[
		PkgManager.YarnV1,
		LockFileMode.Frozen,
		`${testCmd} install --frozen-lockfile ${testExtraArgs}`,
	],
])(
	"returns the correct command for %s and lock mode %s",
	(pkgManager, lockMode, expected) => {
		expect(
			getPkgInstallCommand(pkgManager, lockMode, testExtraArgs, "someVersion"),
		).toBe(expected);
		expect(mockGetPkgManagerCommand).toHaveBeenCalledWith(
			pkgManager,
			"someVersion",
		);
	},
);
