import { getPkgManagerCommand } from "./getPkgManagerCommand";
import { PkgManager } from "../types";

/**
 * Returns the starting command to use if trying to run a binary like tsc, tsx, etc.
 * via a package manager
 * @param pkgManager
 * @returns
 */
export function getPkgBinaryRunnerCommand(
	pkgManager: PkgManager,
	version: string = "latest",
): BinRunCommand {
	switch (pkgManager) {
		case PkgManager.Npm:
			return (cmd: string) =>
				`corepack npx@${version} -c "${cmd.replaceAll(/(?<!\\)"/g, '\\"')}"`;
		case PkgManager.Pnpm:
		case PkgManager.YarnV1:
		case PkgManager.YarnBerry:
			const preCmd = getPkgManagerCommand(pkgManager, version);
			return (cmd: string) => `${preCmd} ${cmd}`;
		default:
			throw new Error(
				`Unimplemented pkg binary runner command for ${pkgManager}`,
			);
	}
}

/**
 * In the event of things like npx, that seem to lose track of the binary,
 * we provide a function that wraps the call.
 */
export type BinRunCommand = (binCmd: string) => string;
