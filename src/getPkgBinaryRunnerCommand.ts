import { PkgManager } from "./types";

/**
 * Returns the starting command to use if trying to run a binary like tsc, tsx, etc.
 * via a package manager
 * @param pkgManager
 * @returns
 */
export function getPkgBinaryRunnerCommand(pkgManager: PkgManager) {
	switch (pkgManager) {
		case PkgManager.Npm:
			return "npx";
		case PkgManager.Pnpm:
			return "pnpm";
		case PkgManager.YarnV1:
		case PkgManager.YarnV4:
			return "yarn";
		default:
			throw new Error(
				`Unimplemented pkg binary runner command for ${pkgManager}`,
			);
	}
}
