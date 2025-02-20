import { PkgManager } from "../types";
import { coerceYarnV1 } from "./coerceYarnV1";

/**
 * Returns the standard call to set up a package manager in a project.  We do this since things
 * like corepack will be non-zero if we haven't explicitly installed this first.
 *
 * Most of these are corepack based
 * @param pkgManager
 * @returns
 */
export function getPkgManagerSetCommand(
	pkgManager: PkgManager,
	version: string = "latest",
) {
	// Note, for corepack, we don't use "use" since that performs a default install too
	switch (pkgManager) {
		case PkgManager.Npm:
			return `corepack npm@${version} --version`;
		case PkgManager.Pnpm:
			return `corepack pnpm@${version} --version`;
		case PkgManager.YarnBerry:
			return `corepack yarn@${version} --version`;
		case PkgManager.YarnV1:
			return `corepack yarn@${coerceYarnV1(version)} --version`;
		default:
			throw new Error(`Unimplemented pkg manager command for ${pkgManager}`);
	}
}
