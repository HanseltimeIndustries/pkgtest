import {
	BinTestRunnerDescribe,
	FileTestRunnerDescribe,
	TestRunnerDescribes,
} from "./types";
import chalk from "chalk";

export function testSuiteDescribe(
	opts: Omit<TestRunnerDescribes, "projectDir">,
) {
	const postfix = (opts as FileTestRunnerDescribe).runBy
		? `Run with ${(opts as FileTestRunnerDescribe).runBy}`
		: (opts as BinTestRunnerDescribe).binTestConfig
			? "Package Bin Commands"
			: "Package Scripts";
	return `Test Suite for Module ${opts.modType}, Package Manager ${opts.pkgManager} (${chalk.magenta(opts.pkgManagerAlias)}), ${postfix}`;
}
