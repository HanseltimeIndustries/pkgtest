import { mkdirSync } from "fs";
import { CollectLogFileStages, CollectLogFilesOn } from "../types";
import { ForLogFilesScanner, ILogFilesScanner } from "./ForLogFilesScanner";
import { getLogCollectFolder } from "../files";
import { resolve } from "path";

export interface ScannerOutput {
	/**
	 * Undefined scanner means you all collects will be false
	 * and that now log collection will occur
	 */
	topLevelScanner?: ILogFilesScanner;
	collect: {
		setup: boolean;
		fileTests: boolean;
		binTests: boolean;
		scriptTests: boolean;
	};
}

const SETUP_STAGES = [CollectLogFileStages.All, CollectLogFileStages.Setup];
const TESTS_STAGES = [CollectLogFileStages.All, CollectLogFileStages.Tests];

/**
 * Creates a top level (i.e. per pkgtest run) log file scanner and collector accordoing to the
 * configuration options.
 * @param options
 * @returns
 */
export function createTopLevelLogFilesScanner(options: {
	collectLogFilesOn?: CollectLogFilesOn;
	collectLogFilesStages?: CollectLogFileStages[];
}): ScannerOutput {
	const { collectLogFilesOn, collectLogFilesStages } = options;

	const noOn = !collectLogFilesOn;
	const noStages = !collectLogFilesStages || collectLogFilesStages.length === 0;

	// No logging needed
	if (noOn && noStages) {
		return {
			collect: {
				setup: false,
				fileTests: false,
				binTests: false,
				scriptTests: false,
			},
		};
	}

	if (noOn || noStages) {
		throw new Error(
			`Must supply both collectLogFilesOn and collectLogFilesStages!`,
		);
	}

	const collectLogTopFolder = resolve(
		getLogCollectFolder(),
		"run-" + new Date().getTime(),
	);
	mkdirSync(collectLogTopFolder, {
		recursive: true,
	});

	return {
		topLevelScanner: new ForLogFilesScanner(
			collectLogTopFolder,
			collectLogFilesOn,
		),
		collect: {
			setup: collectLogFilesStages.some((s) => SETUP_STAGES.includes(s)),
			fileTests: collectLogFilesStages.some(
				(s) => TESTS_STAGES.includes(s) || s === CollectLogFileStages.FileTests,
			),
			binTests: collectLogFilesStages.some(
				(s) => TESTS_STAGES.includes(s) || s === CollectLogFileStages.BinTests,
			),
			scriptTests: collectLogFilesStages.some(
				(s) =>
					TESTS_STAGES.includes(s) || s === CollectLogFileStages.ScriptTests,
			),
		},
	};
}
