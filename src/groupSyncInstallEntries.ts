import { LatestResolvedTestConfigEntry } from "./pkgManager";
import { PkgManager } from "./types";

/**
 * Since some package managers do not behave well with multiple installs, we separate out single
 * configs here.
 * @param entries
 */
export function groupSyncInstallEntries(
	entries: LatestResolvedTestConfigEntry[],
): {
	parallel: boolean;
	entries: LatestResolvedTestConfigEntry[];
}[] {
	// Since yarn-v1 has parallelism issues on install, we want to run yarn-v1 in sync
	const yarnv1Entries = [] as LatestResolvedTestConfigEntry[];
	const yarnberryEntries = [] as LatestResolvedTestConfigEntry[];
	const parallelableEntries = [] as LatestResolvedTestConfigEntry[];
	entries.forEach((ent) => {
		const yarnv1Pms = [] as LatestResolvedTestConfigEntry["packageManagers"];
		const yarnberryPms = [] as LatestResolvedTestConfigEntry["packageManagers"];
		const parallelPms = [] as LatestResolvedTestConfigEntry["packageManagers"];
		ent.packageManagers.forEach((pm) => {
			if (pm.packageManager === PkgManager.YarnV1) {
				yarnv1Pms.push(pm);
			} else if (pm.packageManager === PkgManager.YarnBerry) {
				// windows file locks seem to not like multiple yarn berry installs
				if (process.platform === "win32") {
					yarnberryPms.push(pm);
				} else {
					parallelPms.push(pm);
				}
			} else {
				parallelPms.push(pm);
			}
		});

		if (yarnv1Pms.length > 0) {
			yarnv1Entries.push({
				...ent,
				packageManagers: yarnv1Pms,
			});
		}
		if (yarnberryPms.length > 0) {
			yarnberryEntries.push({
				...ent,
				packageManagers: yarnberryPms,
			});
		}

		if (parallelPms.length > 0) {
			parallelableEntries.push({
				...ent,
				packageManagers: parallelPms,
			});
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
		...(yarnberryEntries.length > 0
			? [
					{
						parallel: false,
						entries: yarnberryEntries,
					},
				]
			: []),
	];
}
