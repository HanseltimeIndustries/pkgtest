import { PkgManager } from "../types";
import { getPkgManagerCommand } from "./getPkgManagerCommand";

export enum LockFileMode {
	/**
	 * This means we are actively avoiding lock file scenarios that could trigger failures.
	 *
	 * This is mainly update except for things like yarn v1, where `--no-lockfile` will not update
	 * but is required to allow ignore the lock files.
	 */
	None = "none",
	/**
	 * Whatever lock file exists should not need to change on install
	 */
	Frozen = "frozen",
	/**
	 * We are running the package manager in a way that it can update the lockfile
	 */
	Update = "update",
}

export function getPkgInstallCommand(
	pkgManager: PkgManager,
	lockFile: LockFileMode,
	installArgs: string,
	version: string = "latest",
) {
	const cmd = getPkgManagerCommand(pkgManager, version);
	const additionalArgs = installArgs ? ` ${installArgs}` : "";
	switch (pkgManager) {
		case PkgManager.Npm:
			if (lockFile === LockFileMode.Frozen) {
				return `${cmd} ci${additionalArgs}`;
			}
			return `${cmd} install${additionalArgs}`;
		case PkgManager.Pnpm:
			return `${cmd} install${lockFile === LockFileMode.Frozen ? " --frozen-lockfile" : ""}${additionalArgs}`;
		case PkgManager.YarnBerry:
			return `${cmd} install${lockFile === LockFileMode.Frozen ? " --immutable" : " --no-immutable"}${additionalArgs}`;
		case PkgManager.YarnV1: {
			let lockArgs = "";
			if (lockFile === LockFileMode.None) {
				lockArgs = " --no-lockfile";
			} else if (lockFile === LockFileMode.Frozen) {
				lockArgs = " --frozen-lockfile";
			}
			return `${cmd} cache clean && ${cmd} install${lockArgs}${additionalArgs} --network-concurrency 1`;
		}
		default:
			throw new Error(
				`Unimplemented pkg manager install command for ${pkgManager}`,
			);
	}
}
