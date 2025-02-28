import { getPkgBinaryRunnerCommand } from "./getPkgBinaryRunnerCommand";
import { PkgManager } from "../types";

describe("getPkgBinaryRunnerCommand", () => {
	const testCases = Object.values(PkgManager).reduce(
		(cases, pkgManager) => {
			if (pkgManager === PkgManager.YarnBerry) {
				cases.push([pkgManager, undefined, 'fn', "corepack yarn@latest fn"]);
				cases.push([pkgManager, "3.4.2", 'fn', "corepack yarn@3.4.2 fn"]);
			} else if (pkgManager === PkgManager.YarnV1) {
				cases.push([pkgManager, undefined, 'fn', "corepack yarn@1.x fn"]);
				cases.push([pkgManager, "1.1.1", 'fn', "corepack yarn@1.1.1 fn"]);
			} else if (pkgManager === PkgManager.Npm) {
				cases.push([pkgManager, undefined, 'fn "somequote"', 'corepack npx@latest -c "fn \\\"somequote\\\""']);
				cases.push([pkgManager, "8.x", 'fn', "corepack npx@8.x -c \"fn\""]);
			} else if (pkgManager === PkgManager.Pnpm) {
				cases.push([pkgManager, undefined, 'fn', "corepack pnpm@latest fn"]);
				cases.push([pkgManager, "9", 'fn', "corepack pnpm@9 fn"]);
			} else {
				throw new Error(`No command mapping expectation for ${pkgManager}`);
			}
			return cases;
		},
		[] as [PkgManager, string | undefined, string, string][],
	);
	it.each(testCases)(
		"returns bin for %s %s",
		(pkgManager, version, cmd, expected) => {
			const binCmdFn = getPkgBinaryRunnerCommand(pkgManager, version);
			expect(binCmdFn(cmd)).toEqual(expected);
		},
	);
});
