import { mkdtemp, rm } from "fs/promises";
import { LIBRARY_NAME, StandardizedTestConfigEntry } from "../config";
import { PkgManager } from "../types";
import { preinstallLatest } from "./preinstallLatest";
import { join } from "path";
import { Logger } from "../Logger";

/**
 * Given a list of test config entries, this will evaluate any entries without explicit versioning so that
 * the latest version is cached for corepack and then resolved to the newest version
 * @param tempDir the base temp directory where we can set up projects to perform clean corepack lookups
 * @param entries
 * @returns
 */
export async function resolveLatestVersions(
	tempDir: string,
	entries: StandardizedTestConfigEntry[],
	logger: Logger,
): Promise<LatestResolvedTestConfigEntry[]> {
	const latestMap: {
		[p in PkgManager]?: Promise<string>;
	} = {};

	return Promise.all(
		entries.map(async (fentry) => {
			const { packageManagers, ...rest } = fentry;
			const resolvedPackageManagers = await Promise.all(
				fentry.packageManagers.map(async (pkgManager) => {
					if (!pkgManager.version) {
						if (!latestMap[pkgManager.packageManager]) {
							// Create a directory
							latestMap[pkgManager.packageManager] = (async () => {
								const preInstallDir = await mkdtemp(
									join(tempDir, `${LIBRARY_NAME}-preinstall-`),
								);
								let version: string;
								try {
									version = await preinstallLatest(
										preInstallDir,
										pkgManager.packageManager,
										logger,
									);
								} finally {
									await rm(preInstallDir, {
										force: true,
										recursive: true,
									});
								}
								return version;
							})();
						}
						return {
							...pkgManager,
							version: await latestMap[pkgManager.packageManager],
						};
					}
					return {
						...pkgManager,
					};
				}),
			);

			return {
				...rest,
				packageManagers: resolvedPackageManagers,
			} as LatestResolvedTestConfigEntry;
		}),
	);
}

export interface LatestResolvedTestConfigEntry
	extends Omit<StandardizedTestConfigEntry, "packageManagers"> {
	packageManagers: (StandardizedTestConfigEntry["packageManagers"][0] & {
		// The version is not reliably resolved
		version: string;
	})[];
}
