import chalk from "chalk";
import { BinTestRunnerDescribe } from "../BinTestRunner";
import { FileTestRunnerDescribe } from "../FileTestRunner";
import { testSuiteDescribe } from "./testSuiteDescribe";

export function skipSuiteDescribe(
	opts: FileTestRunnerDescribe | BinTestRunnerDescribe,
) {
	return `${chalk.yellow("Skipping Suite:")} ${testSuiteDescribe({
		...opts,
	})}`;
}
