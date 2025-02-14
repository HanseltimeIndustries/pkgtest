import { existsSync } from "fs";
import { isAbsolute, resolve } from "path";
import { AdditionalFilesEntry } from "../types";
import { AdditionalFilesCopy } from "./types";

const CONFIG_DIR_KEY = "${configDir}";
const ROOT_DIR_KEY = "${rootDir}";
const KEYS = [CONFIG_DIR_KEY, ROOT_DIR_KEY];

/**
 * Takes a set of additionalFilesEntries and the context in which we're looking them up
 * and creates an entry for use with copyOverAdditionalFiles.
 *
 * This honors keywords:
 *   - pkgDir - the directory with the config file
 *   - rootDir - the directory where we only look for matches
 *
 * @param options
 */
export async function findAdditionalFilesForCopyOver(options: {
	additionalFiles: AdditionalFilesEntry[];
	projectDir: string;
	rootDir: string;
}): Promise<AdditionalFilesCopy[]> {
	const { additionalFiles, projectDir, rootDir } = options;
	return Promise.all(
		additionalFiles.map(async (af) => {
			let toDir: string;
			let match: string;
			if (typeof af === "string") {
				match = af;
				toDir = ".";
			} else {
				match = af[0];
				toDir = af[1];
			}

			const files = [];
			let filePath: string;
			if (isAbsolute(match)) {
				filePath = match;
			} else if (KEYS.some((k) => match.includes(k))) {
				filePath = match
					.replace(CONFIG_DIR_KEY, projectDir)
					.replace(ROOT_DIR_KEY, rootDir);
			} else {
				// Default to rootDir
				filePath = resolve(rootDir, match.replace("${configDir}", projectDir));
			}
			if (!existsSync(filePath)) {
				throw new Error(`Additional file path does not exist: ${filePath}`);
			}
			files.push(filePath);

			return {
				toDir,
				files,
			};
		}),
	);
}
