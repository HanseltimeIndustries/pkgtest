import { StandardizedTestConfigEntry } from "./config";
import { PkgManager, YarnV4Options } from "./types";
import { lt } from "semver";

/**
 * Windows and some package managers do not play along well enough, so we provide a function here
 * to identify that in case people want to have a more streamlines experience.
 */
export function isWindowsProblem(
	_pkgManager: StandardizedTestConfigEntry["packageManagers"][0],
) {
	if (process.platform !== "win32") {
		return false;
	}
	const { packageManager: pkgManager, options: pkgManagerOptions } =
		_pkgManager;
	// Yarn v1 has a never-to-be-fixed problem with local files that can take like 5 min longer on install
	if (pkgManager === PkgManager.YarnV1) {
		return true;
	}
	// Yarn Plug'n'play on node18 fails to play well with Node18
	if (pkgManager === PkgManager.YarnBerry) {
		const nodeLinker = (pkgManagerOptions as YarnV4Options | undefined)?.yarnrc
			?.nodeLinker;
		if (
			(!nodeLinker || nodeLinker === "pnp") &&
			lt(process.version, "20.0.0")
		) {
			return true;
		}
	}
	return false;
}
