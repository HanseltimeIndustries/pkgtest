import { isAbsolute, resolve } from "path";

/**
 * Given an output from some process this will can for log files that we might expect.
 *
 * This is valuable for being able to bundle failed logs on CI processes and archive them, etc.
 * @param output
 * @param cwd - the cwd that the output came from
 * @returns
 */
export function scanOutForLogFiles(output: string, cwd: string): string[] {
	const reg = /[^\s]+\.log/g;
	let log: RegExpExecArray | null = null;
	const logFilesPaths = [] as string[];
	do {
		log = reg.exec(output);
		if (log) {
			const fpath = log[0];
			logFilesPaths.push(isAbsolute(fpath) ? fpath : resolve(cwd, fpath));
		}
	} while (log);
	return logFilesPaths;
}
