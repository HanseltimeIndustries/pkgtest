import { TestRunner } from "../TestRunner";
import { Reporter, TestResult, TestsSummary } from "./types";
import chalk from "chalk";

export class SimpleReporter implements Reporter {
	debug: boolean;
	constructor(options: {
		debug?: boolean;
	}) {
		this.debug = !!options.debug;
	}

	start(runner: TestRunner): void {
		console.log(
			`Test Suite for Module ${runner.modType}, Package Manager ${runner.pkgManager}, Run with ${runner.runBy}`,
		);
		console.log(`Test package location: ${runner.projectDir}`);
	}
	passed(res: TestResult): void {
		const logs = this.debug ? `\n${res.stdout}\n` : "";
		console.log(
			`${chalk.blue("Test: ")} ${res.testCmd}:${logs} ${chalk.green("Passed")} ${chalk.gray(`${res.time} ms`)}`,
		);
	}
	failed(res: TestResult): void {
		const exceededTimeout = res.timedout
			? `\n${chalk.red("Test exceeded timeout")}: ${res.time} ms`
			: "";
		console.error(
			`${chalk.blue("Test: ")} ${res.testCmd}:${exceededTimeout}\n${res.stderr}\n ${chalk.red("Failed")} ${chalk.gray(`${res.time} ms`)}`,
		);
	}
	skipped(res: TestResult): void {
		console.log(
			`${chalk.blue("Test: ")} ${res.testCmd}:\n${res.stderr}\n ${chalk.yellow("Failed")} ${chalk.gray(`${res.time} ms`)}`,
		);
	}
	summary(result: TestsSummary): void {
		const skippedCount =
			result.skipped === 0 ? 0 : chalk.yellow(result.skipped);
		const notReachedCount =
			result.notReached.length === 0
				? 0
				: chalk.yellow(result.notReached.length);
		console.log(
			`Passed: ${chalk.green(result.passed)}\nFailed: ${chalk.red(result.failed)}\nSkipped: ${skippedCount}\nNot Run: ${notReachedCount}\nTotal: ${result.total}`,
		);
		console.log("\n");
	}
}
