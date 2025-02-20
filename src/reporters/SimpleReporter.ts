import { TestGroupOverview } from "./TestGroupOverview";
import { testSuiteDescribe } from "./testSuiteDescribe";
import {
	BinTestRunnerDescribe,
	FileTest,
	FileTestRunnerDescribe,
	Reporter,
	TestResult,
} from "./types";
import chalk from "chalk";

export class SimpleReporter implements Reporter {
	debug: boolean;
	constructor(options: {
		debug?: boolean;
	}) {
		this.debug = !!options.debug;
	}

	start(runner: FileTestRunnerDescribe | BinTestRunnerDescribe): void {
		console.log(testSuiteDescribe(runner));
		console.log(`Test package location: ${runner.projectDir}`);
	}
	passed(res: TestResult): void {
		const logs = this.debug ? `:\n${res.stdout}\n` : "";
		const testName = (res.test as FileTest).orig
			? (res.test as FileTest).orig
			: res.testCmd;
		console.log(
			`${chalk.blue("Test: ")} ${chalk.gray(testName)} ${chalk.green("Passed")} ${chalk.gray(`${res.time} ms`)}\n\t${res.testCmd}:${logs}`,
		);
	}
	failed(res: TestResult): void {
		const exceededTimeout = res.timedout
			? `\n${chalk.red("Test exceeded timeout")}: ${res.time} ms`
			: "";
		const testName = (res.test as FileTest).orig
			? (res.test as FileTest).orig
			: res.testCmd;
		console.error(
			`${chalk.blue("Test: ")} ${chalk.gray(testName)} ${chalk.red("Failed")} ${chalk.gray(`${res.time} ms`)}\n\t${res.testCmd}:${exceededTimeout}\n${res.stderr}`,
		);
	}
	skipped(res: TestResult): void {
		const testName = (res.test as FileTest).orig
			? (res.test as FileTest).orig
			: res.testCmd;
		console.log(
			`${chalk.blue("Test: ")} ${chalk.gray(testName)} ${chalk.yellow("Skipped")} ${chalk.gray(`${res.time} ms`)}\n\t${res.testCmd} `,
		);
	}
	summary(result: TestGroupOverview): void {
		const skippedCount =
			result.skipped === 0 ? 0 : chalk.yellow(result.skipped);
		const notReachedCount =
			result.notReached === 0 ? 0 : chalk.yellow(result.notReached);
		console.log(
			`Passed: ${chalk.green(result.passed)}\nFailed: ${chalk.red(result.failed)}\nSkipped: ${skippedCount}\nNot Run: ${notReachedCount}\nTotal: ${result.total}`,
		);
		console.log("\n");
	}
}
