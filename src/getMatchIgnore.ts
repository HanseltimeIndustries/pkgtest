// For now, we skip things we know that are not gonna have anything in them
const KNOWN_IGNORES = [
    "**/node_modules/**",
    "**/.yarn/**",
    "**/.git/**",
]

/**
 * Returns the aggregate set of ignores so avoid looking for tests in.
 *
 * Currently, this takes any explicit ignores and lumps them together with any .gitignore file at
 * the cwd.
 *
 * TODO: it would be great to consume .gitignore but negations mean there's a complex combination that isn't just making globs
 * from each line
 * @param cwd
 * @param explicit
 * @returns
 */
export function getMatchIgnore(_cwd: string, explicit: string[] = []) {
	// const gitignore = resolve(cwd, ".gitignore");
	// if (existsSync(gitignore)) {
	// 	return [
	// 		...explicit,
	// 		gitignoreToMinimatch(readFileSync(gitignore)
	// 			.toString()),
	// 			.split("\n")
	// 			.reduce((ignores, line) => {
	// 				const trim = line.trim();
	// 				if (trim && !trim.startsWith("#")) {
	// 					ignores.push(gitignoreToMinimatch(trim)); // This is insufficient and would need to be overhauled
	// 				}
	// 				return ignores;
	// 			}, [] as string[]),
	// 	];
	// }
	return [...explicit, ...KNOWN_IGNORES];
}
