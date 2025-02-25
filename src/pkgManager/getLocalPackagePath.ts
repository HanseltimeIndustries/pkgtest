import { PkgManager } from "../types";

export function getLocalPackagePath(
	pkgManager: PkgManager,
	packageRelativePath: string,
) {
	switch (pkgManager) {
		case PkgManager.YarnBerry:
			// Yarn v4 does not play well with file:// since it tries zipping things it shouldn't
			return `portal:${packageRelativePath.replaceAll('\\', '/')}`;
		case PkgManager.Npm:
		case PkgManager.YarnV1:
		case PkgManager.Pnpm:
			return process.platform === "win32"
				? packageRelativePath
				: `file:${packageRelativePath}`;
		default:
			throw new Error(`No Local Package Path for ${pkgManager}`);
	}
}
