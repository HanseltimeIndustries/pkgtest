import { Logger } from "./Logger";
import { TestGroupOverview } from "./reporters";
import { BaseTestRunner } from "./runners/BaseTestRunner";
import { FailFastError } from "./types";

/**
 * Abstraction to run a set of runners that are of the same type of suite using a pool of max "parallel number"
 *
 * Callers should remember to wrap this method and finalize overviews in a finally block in
 * case of failures.
 * @param runners
 * @param suitesOverview
 * @param testsOverview
 * @param runArgs
 * @returns
 */
export async function executeRunners<T>(
	runners: BaseTestRunner<T>[],
	suitesOverview: TestGroupOverview,
	testsOverview: TestGroupOverview,
	context: {
		logger: Logger;
		/**
		 * The max number of suites to run at a time
		 */
		parallel: number;
	},
	runArgs: T,
) {
	const { logger, parallel } = context;
	const promisesToRun: (() => Promise<void>)[] = [];
	let pass = true;
	suitesOverview.startTime();
	testsOverview.startTime();
	for (const runner of runners) {
		promisesToRun.push(async () => {
			const summary = await runner.runTests(runArgs);
			// Do all tests updating
			if (summary.failed > 0) {
				suitesOverview.fail(1);
				pass = false;
			} else {
				suitesOverview.pass(1);
			}
			testsOverview.addToTotal(summary.total);
			testsOverview.fail(summary.failed);
			testsOverview.pass(summary.passed);
			testsOverview.skip(summary.skipped);

			if (summary.failedFast) {
				// Fail normally instead of letting an error make it to the top
				logger.log("Tests failed fast");
				throw new FailFastError("Tests failed fast");
			}
		});
	}
	await pool(promisesToRun, parallel);
	testsOverview.finalize();
	suitesOverview.finalize();
	return pass;
}

async function pool(lambdas: (() => Promise<void>)[], maxNumber: number) {
	const promiseMap: {
		[k: string]: Promise<void>;
	} = {};

	try {
		for (let idx = 0; idx < lambdas.length; idx++) {
			const lambda = lambdas[idx];
			promiseMap[idx] = (async () => {
				await lambda();
				delete promiseMap[idx];
			})();
			if (Object.keys(promiseMap).length === maxNumber) {
				await Promise.any(Object.values(promiseMap));
			}
		}
	} finally {
		await Promise.all(Object.values(promiseMap));
	}
}
