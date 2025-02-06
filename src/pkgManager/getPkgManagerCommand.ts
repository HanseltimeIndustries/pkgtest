import { PkgManager } from "../types";
import { coerceYarnV1 } from "./coerceYarnV1";

/**
 * Returns the most standard way to run a package manager at a certain version.
 *
 * Most of these are corepack based
 * @param pkgManager
 * @returns
 */
export function getPkgManagerCommand(
	pkgManager: PkgManager,
	version: string = "latest",
) {
	switch (pkgManager) {
		case PkgManager.Npm:
			// Corepack does not run npm
			return `corepack npm@${version}`;
		case PkgManager.Pnpm:
			return `corepack pnpm@${version}`;
		case PkgManager.YarnBerry:
			return `corepack yarn@${version}`;
		case PkgManager.YarnV1:
			if (version !== "latest" && !version.startsWith("1")) {
				throw new Error(
					`Unexpected error for yarn version 1 (${version}).  Must be in 1 range`,
				);
			}
			return `corepack yarn@${coerceYarnV1(version)}`;
		default:
			throw new Error(`Unimplemented pkg manager command for ${pkgManager}`);
	}
}
