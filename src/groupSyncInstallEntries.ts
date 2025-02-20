import { StandardizedTestConfigEntry } from "./config";
import { PkgManager } from "./types";

/**
 * Since some package managers do not behave well with multiple installs, we separate out single
 * configs here.
 * @param entries
 */
export function groupSyncInstallEntries(
	entries: StandardizedTestConfigEntry[],
): {
	parallel: boolean;
	entries: StandardizedTestConfigEntry[];
}[] {
	// Since yarn-v1 has parallelism issues on install, we want to run yarn-v1 in sync
	const yarnv1Entries = [] as StandardizedTestConfigEntry[];
	const parallelableEntries = [] as StandardizedTestConfigEntry[];
	entries.forEach((ent) => {
		const yarnv1Pms = [] as StandardizedTestConfigEntry["packageManagers"];
		const parallelPms = [] as StandardizedTestConfigEntry["packageManagers"];
		ent.packageManagers.forEach((pm) => {
			if (pm.packageManager === PkgManager.YarnV1) {
				yarnv1Pms.push(pm);
			} else {
				parallelPms.push(pm);
			}
		});

		if (yarnv1Pms.length > 0) {
			yarnv1Entries.push({
				...ent,
				packageManagers: yarnv1Pms,
			});
			if (parallelPms.length > 0) {
				parallelableEntries.push({
					...ent,
					packageManagers: parallelPms,
				});
			}
		} else {
			parallelableEntries.push(ent);
		}
	});
	return [
		{
			parallel: false,
			entries: yarnv1Entries,
		},
		{
			parallel: true,
			entries: parallelableEntries,
		},
	];
}
