import {
	BinTestRunnerDescribe,
	FileTestRunnerDescribe,
	TestRunnerDescribes,
} from "./types";
import type { ChalkInstance } from "chalk" with { "resolution-mode": "import" };

export function testSuiteDescribe(
	opts: Omit<TestRunnerDescribes, "projectDir">,
	chalk: ChalkInstance,
) {
	const postfix = (opts as FileTestRunnerDescribe).runBy
		? `Run with ${(opts as FileTestRunnerDescribe).runBy}`
		: (opts as BinTestRunnerDescribe).binTestConfig
			? "Package Bin Commands"
			: "Package Scripts";
	return `Test Suite for Module ${opts.modType}, Package Manager ${opts.pkgManager} (${chalk.magenta(opts.pkgManagerAlias)}), ${postfix}`;
}
