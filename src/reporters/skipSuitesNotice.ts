import chalk from "chalk";
import {
	TestRunnerDescribes,
} from "./types";
import { testSuiteDescribe } from "./testSuiteDescribe";

export function skipSuiteDescribe(
	opts: Omit<TestRunnerDescribes, "projectDir">,
) {
	return `${chalk.yellow("Skipping Suite:")} ${testSuiteDescribe({
		...opts,
	})}`;
}
