import { readdirSync } from "fs";
import { isAbsolute, dirname, resolve } from "path";

/**
 * Finds the root by looking for an expected root file
 *
 * Note: this might not work well with monorepos
 * @param cwd
 * @param rootFile
 * @returns
 */
export function findRoot(cwd: string, rootFile: string) {
	const dir = isAbsolute(cwd) ? cwd : resolve(process.cwd(), cwd);
	const isRoot = readdirSync(dir).some((f) => f === rootFile);
	if (!isRoot) {
		return findRoot(dirname(dir), rootFile);
	}
	return dir;
}
