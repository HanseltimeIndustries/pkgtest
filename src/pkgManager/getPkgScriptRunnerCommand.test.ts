import { getPkgScriptRunnerCommand } from "./getPkgScriptRunnerCommand";
import { PkgManager } from "../types";

describe("getPkgScriptRunnerCommand", () => {
	const testCases = Object.values(PkgManager).reduce(
		(cases, pkgManager) => {
			if (pkgManager === PkgManager.YarnBerry) {
				cases.push([pkgManager, undefined, "corepack yarn@latest"]);
				cases.push([pkgManager, "3.4.2", "corepack yarn@3.4.2"]);
			} else if (pkgManager === PkgManager.YarnV1) {
				cases.push([pkgManager, undefined, "corepack yarn@1.x"]);
				cases.push([pkgManager, "1.1.1", "corepack yarn@1.1.1"]);
			} else if (pkgManager === PkgManager.Npm) {
				cases.push([pkgManager, undefined, "corepack npm@latest run"]);
				cases.push([pkgManager, "8.x", "corepack npm@8.x run"]);
			} else if (pkgManager === PkgManager.Pnpm) {
				cases.push([pkgManager, undefined, "corepack pnpm@latest run"]);
				cases.push([pkgManager, "9", "corepack pnpm@9 run"]);
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
			expect(getPkgScriptRunnerCommand(pkgManager, version)).toEqual(expected);
		},
	);
});
