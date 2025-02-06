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
	switch (pkgManager) {
		case PkgManager.Npm:
			// Corepack does not run npm
			return `corepack use npm@${version}`;
		case PkgManager.Pnpm:
			return `corepack use pnpm@${version}`;
		case PkgManager.YarnBerry:
			return `corepack use yarn@${version}`;
		case PkgManager.YarnV1:
			return `corepack use yarn@${coerceYarnV1(version)}`;
		default:
			throw new Error(`Unimplemented pkg manager command for ${pkgManager}`);
	}
}
