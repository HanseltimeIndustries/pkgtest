import { getPkgBinaryRunnerCommand } from "./getPkgBinaryRunnerCommand";
import { PkgManager } from "./types";

describe("getPkgBinaryRunnerCommand", () => {
	const testCases = Object.values(PkgManager).map((pkgManager) => {
		if (pkgManager === PkgManager.YarnV1 || pkgManager === PkgManager.YarnV4) {
			return [pkgManager, "yarn"];
		}
		if (pkgManager === PkgManager.Npm) {
			return [pkgManager, "npx"];
		}
		if (pkgManager === PkgManager.Pnpm) {
			return [pkgManager, "pnpm"];
		}
		throw new Error(`No command mapping expectation for ${pkgManager}`);
	}) as [PkgManager, string][];
	it.each(testCases)("returns bin for %s", (pkgManager, expected) => {
		expect(getPkgBinaryRunnerCommand(pkgManager)).toEqual(expected);
	});
});
