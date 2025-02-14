import { statSync } from "fs";
import { cp } from "fs/promises";
import { AdditionalFilesCopy } from "./types";
import { isAbsolute, resolve } from "path";

export async function copyOverAdditionalFiles(
	copyOver: AdditionalFilesCopy[],
	testProjectDir: string,
) {
	return Promise.all(
		copyOver.map(async ({ files, toDir }) => {
			if (isAbsolute(toDir)) {
				throw new Error(
					`Supplied a non-relative path for copying additional files: ${toDir}`,
				);
			}
			const fullToDir = resolve(testProjectDir, toDir);
			await Promise.all(
				files.map(async (f) => {
					if (statSync(f).isDirectory()) {
						await cp(f, fullToDir, {
							recursive: true,
						});
					} else {
						await cp(f, fullToDir);
					}
				}),
			);
		}),
	);
}
