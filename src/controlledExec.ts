import { exec, ExecOptions } from "child_process";
import { Logger, ScanForLogFilesLogger } from "./logging";
import { resolve } from "path";

export enum CollectLogFilesOn {
	Error = "error",
	All = "all",
}

export interface CollectLogFilesOptions {
	/** Whether to only collect on an error of the script or everytime (impacts performance) */
	on: CollectLogFilesOn;
	/** The folder that we copy each log file to*/
	toFolder: string;
	/**
	 * If provided, this is a base folder for us to write to within the toFolder -
	 * this is good for isolating in a single folder for something like commands creating one projects
	 * and putting any locks under install somewhere and compile elsewhere
	 */
	subFolder?: string;
}

export async function controlledExec(
	cmd: string,
	options: ExecOptions,
	logger: Logger,
	/**
	 * If we want to scan and collect any log files mentioned in the stdout/err
	 */
	collectLogFiles?: false | CollectLogFilesOptions,
	innerOpts?: {
		/** Don't write anything to the logger for stdout if no error */
		onlyReturnStdOut: boolean;
	},
) {
	const cwd = options.cwd ? options.cwd.toString() : process.cwd();
	const collectOnError = collectLogFiles ? true : false;
	const collectOnNormal = collectLogFiles
		? collectLogFiles.on === CollectLogFilesOn.All
		: false;
	return await new Promise<string>((res, rej) => {
		exec(cmd, options, (error, stdout, stderr) => {
			// Determine the logger we use to make sure we don't scan stdout on Error only collection
			let resolvedLogger: Logger | ScanForLogFilesLogger;
			if ((error && collectOnError) || (!error && collectOnNormal)) {
				resolvedLogger = new ScanForLogFilesLogger(
					logger,
					cwd,
					resolve(
						(collectLogFiles as CollectLogFilesOptions).toFolder,
						(collectLogFiles as CollectLogFilesOptions).subFolder ?? "",
					),
				);
			} else {
				resolvedLogger = logger;
			}
			if (error) {
				resolvedLogger.log(stdout);
				resolvedLogger.error(stderr);
				if (collectOnError) {
					(resolvedLogger as ScanForLogFilesLogger).collectLogFiles();
				}
				rej(error);
			} else {
				if (stdout) {
					if (innerOpts?.onlyReturnStdOut) {
						if (collectOnNormal) {
							(resolvedLogger as ScanForLogFilesLogger).scanOnly(stdout);
						}
					} else {
						resolvedLogger.logDebug(stdout);
					}
				}
				if (stderr) {
					resolvedLogger.logDebug(stderr);
				}
				if (collectOnNormal) {
					(resolvedLogger as ScanForLogFilesLogger).collectLogFiles();
				}
				res(stdout.trim());
			}
		});
	});
}
