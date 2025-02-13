import { BinTestRunnerDescribe } from "../BinTestRunner";
import { FileTestRunnerDescribe } from "../FileTestRunner";
import chalk from "chalk";

export function testSuiteDescribe(
	opts: FileTestRunnerDescribe | BinTestRunnerDescribe,
) {
	const postfix = (opts as FileTestRunnerDescribe).runBy
		? `Run with ${(opts as FileTestRunnerDescribe).runBy}`
		: "Package Bin Commands";
	return `Test Suite for Module ${opts.modType}, Package Manager ${opts.pkgManager} (${chalk.magenta(opts.pkgManagerAlias)}), ${postfix}`;
}
