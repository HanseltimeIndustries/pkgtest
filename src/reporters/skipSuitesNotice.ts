import chalk from "chalk";
import { BinTestRunnerDescribe, FileTestRunnerDescribe } from "./types";
import { testSuiteDescribe } from "./testSuiteDescribe";

export function skipSuiteDescribe(
	opts:
		| Omit<FileTestRunnerDescribe, "projectDir">
		| Omit<BinTestRunnerDescribe, "projectDir">,
) {
	return `${chalk.yellow("Skipping Suite:")} ${testSuiteDescribe({
		...opts,
	})}`;
}
