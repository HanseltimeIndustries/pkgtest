// biome-ignore syntax/correctness/noTypeOnlyImportAttributes: known bug
import type { ChalkInstance } from "chalk" with { "resolution-mode": "import" };
import { TestGroupOverview } from "./TestGroupOverview";
import { testSuiteDescribe } from "./testSuiteDescribe";
import {
	BinTestRunnerDescribe,
	FileTest,
	FileTestRunnerDescribe,
	Reporter,
	TestResult,
} from "./types";

export class SimpleReporter implements Reporter {
	debug: boolean;
	private chalk: ChalkInstance;
	constructor(options: {
		debug?: boolean;
		chalk: ChalkInstance;
	}) {
		this.debug = !!options.debug;
		this.chalk = options.chalk;
	}

	start(runner: FileTestRunnerDescribe | BinTestRunnerDescribe): void {
		console.log(testSuiteDescribe(runner, this.chalk));
		console.log(`Test package location: ${runner.projectDir}`);
	}
	passed(res: TestResult): void {
		const logs = this.debug ? `:\n${res.stdout}\n` : "";
		const testName = (res.test as FileTest).orig
			? (res.test as FileTest).orig
			: res.testCmd;
		console.log(
			`${this.chalk.blue("Test: ")} ${this.chalk.gray(testName)} ${this.chalk.green("Passed")} ${this.chalk.gray(`${res.time} ms`)}\n\t${res.testCmd}:${logs}`,
		);
	}
	failed(res: TestResult): void {
		const exceededTimeout = res.timedout
			? `\n${this.chalk.red("Test exceeded timeout")}: ${res.time} ms`
			: "";
		const testName = (res.test as FileTest).orig
			? (res.test as FileTest).orig
			: res.testCmd;
		console.error(
			`${this.chalk.blue("Test: ")} ${this.chalk.gray(testName)} ${this.chalk.red("Failed")} ${this.chalk.gray(`${res.time} ms`)}\n\t${res.testCmd}:${exceededTimeout}\n${res.stderr}`,
		);
	}
	skipped(res: TestResult): void {
		const testName = (res.test as FileTest).orig
			? (res.test as FileTest).orig
			: res.testCmd;
		console.log(
			`${this.chalk.blue("Test: ")} ${this.chalk.gray(testName)} ${this.chalk.yellow("Skipped")} ${this.chalk.gray(`${res.time} ms`)}\n\t${res.testCmd} `,
		);
	}
	summary(result: TestGroupOverview): void {
		const skippedCount =
			result.skipped === 0 ? 0 : this.chalk.yellow(result.skipped);
		const notReachedCount =
			result.notReached === 0 ? 0 : this.chalk.yellow(result.notReached);
		console.log(
			`Passed: ${this.chalk.green(result.passed)}\nFailed: ${this.chalk.red(result.failed)}\nSkipped: ${skippedCount}\nNot Run: ${notReachedCount}\nTotal: ${result.total}`,
		);
		console.log("\n");
	}
}
