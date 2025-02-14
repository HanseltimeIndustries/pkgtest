import { BinTestRunnerDescribe, FileTestRunnerDescribe } from "./types";
import chalk from "chalk";

export function testSuiteDescribe(
	opts: Omit<FileTestRunnerDescribe | BinTestRunnerDescribe, "projectDir">,
) {
	const postfix = (opts as FileTestRunnerDescribe).runBy
		? `Run with ${(opts as FileTestRunnerDescribe).runBy}`
		: "Package Bin Commands";
	return `Test Suite for Module ${opts.modType}, Package Manager ${opts.pkgManager} (${chalk.magenta(opts.pkgManagerAlias)}), ${postfix}`;
}
