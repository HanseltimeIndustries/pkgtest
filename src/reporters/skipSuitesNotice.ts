import type { ChalkInstance } from "chalk" with { "resolution-mode": "import" };
import { TestRunnerDescribes } from "./types";
import { testSuiteDescribe } from "./testSuiteDescribe";

export function skipSuiteDescribe(
	opts: Omit<TestRunnerDescribes, "projectDir">,
	chalk: ChalkInstance,
) {
	return `${chalk.yellow("Skipping Suite:")} ${testSuiteDescribe({
		...opts,
	}, chalk)}`;
}
