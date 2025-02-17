import { PkgManager } from "../types";

export const lockFiles = {
	[PkgManager.YarnV1]: "yarn.lock",
	[PkgManager.YarnBerry]: "yarn.lock",
	[PkgManager.Npm]: "package-lock.json",
	[PkgManager.Pnpm]: "pnpm-lock.yaml",
};
