import { getPkgManagerCommand } from "./getPkgManagerCommand";
import { PkgManager } from "../types";

/**
 * Returns the starting command to use if trying to run a package.json script
 * via a package manager
 * @param pkgManager
 * @returns
 */
export function getPkgScriptRunnerCommand(
	pkgManager: PkgManager,
	version: string = "latest",
) {
	switch (pkgManager) {
		case PkgManager.Npm:
		case PkgManager.Pnpm:
			return `${getPkgManagerCommand(pkgManager, version)} run`;
		case PkgManager.YarnV1:
		case PkgManager.YarnBerry:
			return getPkgManagerCommand(pkgManager, version);
		default:
			throw new Error(
				`Unimplemented pkg binary runner command for ${pkgManager}`,
			);
	}
}
