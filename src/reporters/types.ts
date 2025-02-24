import {
	BinTestConfig,
	ModuleTypes,
	PkgManager,
	RunWith,
	ScriptTestConfig,
} from "../types";
import { TestGroupOverview } from "./TestGroupOverview";

export interface TestFile {
	/** The original file name - i.e. the file that was copied, relative to the cwd of the framework */
	orig: string;
	/** The actual testFile that we want to run (i.e. copied or compiled) */
	actual: string;
}

export interface BinTest {
	bin: string;
	args: string;
	env?: Record<string, string>;
}

export interface ScriptTest {
	/**
	 * The script name
	 */
	name: string;
}

export interface FileTest extends TestFile {
	/**
	 * The actual command run - this is in effect the true test
	 */
	command: string;
}

export type TestDescriptor = FileTest | BinTest | ScriptTest;

export type NotReachedInfo = TestFile | BinTest;

export interface FileTestRunnerDescribe {
	readonly modType: ModuleTypes;
	readonly pkgManager: PkgManager;
	readonly pkgManagerAlias: string;
	readonly runBy: RunWith;
	readonly projectDir: string;
}

export interface BinTestRunnerDescribe {
	readonly pkgManager: PkgManager;
	readonly pkgManagerAlias: string;
	readonly modType: ModuleTypes;
	readonly binTestConfig: BinTestConfig;
	readonly projectDir: string;
}

export interface ScriptTestRunnerDescribe {
	readonly pkgManager: PkgManager;
	readonly pkgManagerAlias: string;
	readonly modType: ModuleTypes;
	readonly scriptTests: ScriptTestConfig[];
	readonly projectDir: string;
}

export type TestRunnerDescribes =
	| FileTestRunnerDescribe
	| BinTestRunnerDescribe
	| ScriptTestRunnerDescribe;

export interface TestResult {
	/**
	 * The command that was executed
	 */
	testCmd: string;
	test: TestDescriptor;
	/**
	 * The time in seconds that is took took to execute
	 */
	time: number;
	stdout?: string;
	stderr?: string;
	/**
	 * Only available if the result failed and it was due to timeout
	 */
	timedout?: boolean;
}

export interface TestsSummary {
	passed: number;
	failed: number;
	/**
	 * This number has a bit of nuance.  In a fail fast scenario, there are 2 types of
	 * skipped - 'skipped' and 'notReached'
	 *
	 * A skipped test means there as some explicit designation on the test that made us skip it
	 * (but we definitely reached it).  An unreached test would be tests that failed to execute
	 * because we stopped running on an error (they may have run or not under the current test
	 * conditions).
	 */
	skipped: number;
	/**
	 * Not reached is a list of test names that were not run due to a fail fast event
	 */
	notReached: NotReachedInfo[];
	/**
	 * passed + failed + skipped + notReached.length
	 */
	total: number;
	/**
	 * total time in ms that it took to run all tests
	 */
	time: number;
	failedFast: boolean;
}

/**
 * Reporter interface that can be used to report out results of each test
 * as well as the summary of results at the end.
 *
 * The TestRunner does not, itself write to console, but instead relies on your
 * reporter to do that.
 */
export interface Reporter {
	/**
	 * Called at the beginning of a run.  This gives you the chance to write some sort of
	 * header text
	 *
	 * @param runner
	 */
	start(
		runner:
			| FileTestRunnerDescribe
			| BinTestRunnerDescribe
			| ScriptTestRunnerDescribe,
	): void;
	passed(res: TestResult): void;
	failed(res: TestResult): void;
	skipped(res: TestResult): void;
	/**
	 * Called at the end of a run.  This gives you the change to write some sort of footer text
	 * @param result
	 */
	summary(result: TestGroupOverview): void;
}
