import { statSync } from "fs";
import { readdir } from "fs/promises";
import micromatch from "micromatch";
import { join, sep } from "path";

export async function getAllMatchingFiles(
	dir: string,
	glob: string,
	ignoreGlobs?: string[],
	_topDir?: string,
): Promise<string[]> {
	const topDir = _topDir ?? (dir.endsWith(sep) ? dir : dir + sep);
	const files = await readdir(dir);
	const matchedFiles = await Promise.all<string[] | string | undefined>(
		files.map(async (f) => {
			const fullPath = join(dir, f);
			let normalizedMatchPath = fullPath.replace(topDir, "");
			if (sep !== "/") {
				// Normalize windows paths to work with unix glob paths
				normalizedMatchPath = normalizedMatchPath.replaceAll(sep, "/");
			}
			if (statSync(fullPath).isDirectory()) {
				if (
					ignoreGlobs?.some((iglob) =>
						micromatch.isMatch(
							// Normalize to end with '/' for better formed globs
							normalizedMatchPath.endsWith("/")
								? normalizedMatchPath
								: normalizedMatchPath + "/",
							iglob,
						),
					)
				) {
					return undefined;
				}
				return await getAllMatchingFiles(fullPath, glob, ignoreGlobs, topDir);
			} else {
				// Localize the path so that we can't get other matches based on upstream folders
				return micromatch.isMatch(normalizedMatchPath, glob)
					? fullPath
					: undefined;
			}
		}),
	);

	return matchedFiles.reduce((res: string[], fMatch) => {
		if (!fMatch) {
			return res;
		}
		if (Array.isArray(fMatch)) {
			res.push(...fMatch);
		} else {
			res.push(fMatch);
		}

		return res;
	}, [] as string[]);
}
