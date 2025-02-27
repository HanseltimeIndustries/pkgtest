import { PkgManager } from "../types";
import { isAbsolute } from "path";

/**
 * This method will apply an escaping needed for injecting the "local" package file paths
 * into lock files based on the platform.  Particularly windows and local paths struggle a lot.
 * @param pkgManager
 * @param path
 * @returns
 */
export function applyLockLocalFileEscaping(
	pkgManager: PkgManager,
	path: string,
) {
	switch (pkgManager) {
		case PkgManager.YarnV1: {
			// Yarn v1 uses double escaped "\"
			const escaped = path.replaceAll(/([^\\])\\([^\\])/g, "$1\\\\$2");
			if (escaped.endsWith("\\")) {
				// See if we need to apply escaping to the last char
				if (escaped.length === 1) {
					return "\\\\";
				}
				if (escaped.charAt(escaped.length - 2) !== "\\") {
					return escaped + "\\";
				}
			}
			return escaped;
		}
		case PkgManager.YarnBerry:
		case PkgManager.Npm: {
			// Yarn berry normalizes to unix paths
			if (process.platform === "win32") {
				const escaped = path.replaceAll(/\\+/g, "/");
				return isAbsolute(path) ? "/" + escaped : escaped;
			}
			return path;
		}
		default:
			return path;
	}
}
