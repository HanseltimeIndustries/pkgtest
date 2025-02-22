import { readdirSync, statSync } from "fs";
import { getTempProjectDirPrefix } from "./getTempProjectDirPrefix";
import { join } from "path";

/**
 * This will return any pkgtest projects in the current temp directory provided
 *
 * This is meant to be used for auditing projects that were left over either from force
 * killing a pkgtest run before it could clean up resources or from use of --preserve
 *
 * @param {string} tempDir - The directory that pkgtest would've been using as a temp directory
 */
export function findPkgTestProjectsByPrefix(tempDir: string) {
	const folderPrefix = getTempProjectDirPrefix();
	const files = readdirSync(tempDir).filter((o) => {
		if (o.startsWith(folderPrefix)) {
			// We only create folders so only select folders
			if (statSync(join(tempDir, o)).isDirectory()) {
				return true;
			}
		}
		return false;
	});
	return files;
}
