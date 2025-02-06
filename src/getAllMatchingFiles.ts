import { statSync } from "fs";
import { readdir } from "fs/promises";
import micromatch from "micromatch";
import { join, sep } from "path";

export async function getAllMatchingFiles(
	dir: string,
	glob: string,
	_topDir?: string,
): Promise<string[]> {
	const topDir = _topDir ?? (dir.endsWith(sep) ? dir : dir + sep);
	const files = await readdir(dir);
	const matchedFiles = await Promise.all<string[] | string | undefined>(
		files.map(async (f) => {
			const fullPath = join(dir, f);
			if (statSync(fullPath).isDirectory()) {
				return await getAllMatchingFiles(fullPath, glob, topDir);
			} else {
				// Localize the path so that we can't get other matches based on upstream folders
				return micromatch.isMatch(fullPath.replace(topDir, ""), glob)
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
