import { StandardizedTestConfigEntry } from "../config";
import { PkgManager } from "../types";

/**
 * Simple aggregation of pkgManagers summation in entries
 */
export function getPkgManagers(entries: StandardizedTestConfigEntry[]) {
	return Array.from(
		entries.reduce((s, entry) => {
			entry.packageManagers.forEach((pm) => {
				s.add(pm.packageManager);
			});
			return s;
		}, new Set<PkgManager>()),
	);
}
