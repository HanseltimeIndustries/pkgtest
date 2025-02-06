import { getPkgManagerCommand } from "./getPkgManagerCommand";
import { PkgManager } from "../types";

/**
 * Returns the starting command to use if trying to run a binary like tsc, tsx, etc.
 * via a package manager
 * @param pkgManager
 * @returns
 */
export function getPkgBinaryRunnerCommand(
	pkgManager: PkgManager,
	version: string = "latest",
) {
	switch (pkgManager) {
		case PkgManager.Npm:
			return `corepack npx@${version}`;
		case PkgManager.Pnpm:
		case PkgManager.YarnV1:
		case PkgManager.YarnBerry:
			return getPkgManagerCommand(pkgManager, version);
		default:
			throw new Error(
				`Unimplemented pkg binary runner command for ${pkgManager}`,
			);
	}
}
