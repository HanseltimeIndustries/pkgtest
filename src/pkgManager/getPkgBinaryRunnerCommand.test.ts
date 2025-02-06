import { getPkgBinaryRunnerCommand } from "./getPkgBinaryRunnerCommand";
import { PkgManager } from "../types";

describe("getPkgBinaryRunnerCommand", () => {
	const testCases = Object.values(PkgManager).reduce(
		(cases, pkgManager) => {
			if (
				pkgManager === PkgManager.YarnV1 ||
				pkgManager === PkgManager.YarnV4
			) {
				cases.push([pkgManager, undefined, "corepack yarn@latest"]);
				cases.push([pkgManager, "1.1.1", "corepack yarn@1.1.1"]);
			} else if (pkgManager === PkgManager.Npm) {
				cases.push([pkgManager, undefined, "corepack npx@latest"]);
				cases.push([pkgManager, "8.x", "corepack npx@8.x"]);
			} else if (pkgManager === PkgManager.Pnpm) {
				cases.push([pkgManager, undefined, "corepack pnpm@latest"]);
				cases.push([pkgManager, "9", "corepack pnpm@9"]);
			} else {
				throw new Error(`No command mapping expectation for ${pkgManager}`);
			}
			return cases;
		},
		[] as [PkgManager, string | undefined, string][],
	);
	it.each(testCases)(
		"returns bin for %s %s",
		(pkgManager, version, expected) => {
			expect(getPkgBinaryRunnerCommand(pkgManager, version)).toEqual(expected);
		},
	);
});
